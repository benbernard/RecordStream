package App::RecordStream::Operation::xform;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Executor::Getopt;
use App::RecordStream::Executor;

sub init {
  my $this = shift;
  my $args = shift;

  my $executor_options = App::RecordStream::Executor::Getopt->new();
  my $before = 0;
  my $after  = 0;
  my $post_snippet;
  my $pre_snippet;

  my $spec = {
    'B|before=n'     => \$before,
    'A|after=n'      => \$after,
    'C|context=n'    => sub { $before = $_[1]; $after = $_[1]; },
    'post-snippet=s' => \$post_snippet,
    'pre-snippet=s'  => \$pre_snippet,
    $executor_options->arguments(),
  };

  Getopt::Long::Configure("bundling");
  $this->parse_options($args, $spec);

  my $expression = $executor_options->get_string($args);
  my $executor = $this->create_executor($expression, $post_snippet, $pre_snippet);

  $this->{'BEFORE'}   = $before;
  $this->{'AFTER'}    = $after;
  $this->{'EXECUTOR'} = $executor;

  $this->{'XFORM_REF'} = $executor->get_code_ref('xform');

  $this->{'BEFORE_ARRAY'}   = [];
  $this->{'AFTER_ARRAY'}    = [];
  $this->{'SPOOLED_INPUT'}  = [];
  $this->{'SPOOLED_OUTPUT'} = [];

  $executor->execute_method('pre_xform');
  $this->handle_spools();
}

sub create_executor {
  my $this         = shift;
  my $snippet      = shift;
  my $post_snippet = shift || '';
  my $pre_snippet  = shift || '';

  my $args = {
    xform => {
      code => "\$line++; $snippet; \$r",
      arg_names => [qw(r filename B A)],
    },
    post_xform => {
      code => $post_snippet,
    },
    pre_xform => {
      code => $pre_snippet,
    },
  };

  my $executor;
  eval {
    $executor =  App::RecordStream::Executor->new($args);
  };

  if ( $@ ) {
    die "FATAL: Problem compiling a snippet: $@";
  }

  # Initialize the annonymous sub refs to contain $this
  $executor->set_executor_method('push_input', sub {
      $this->push_input(@_);
    });

  $executor->set_executor_method('push_output', sub {
      $this->push_output(@_);
    });

  return $executor;
}

sub push_input {
  my $this = shift;
  push @{$this->{'SPOOLED_INPUT'}}, @_;
}

sub push_output {
  my $this = shift;
  $this->{'SUPPRESS_R'} = 1;
  push @{$this->{'SPOOLED_OUTPUT'}}, @_;
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  my $before = $this->{'BEFORE'};
  my $after  = $this->{'AFTER'};

  if ( $before == 0 && $after == 0 ) {
    return $this->run_record_with_context($record);
  }

  my $before_array   = $this->{'BEFORE_ARRAY'};
  my $after_array    = $this->{'AFTER_ARRAY'};
  my $current_record = $this->{'CURRENT_RECORD'};

  push @$after_array, $record;

  if ( scalar @$after_array > $after ) {
    my $new_record = shift @$after_array;

    unshift @$before_array, $current_record if ( $current_record );
    $current_record = $new_record;
  }

  if ( scalar @$after_array > $after ) {
    my $new_record = shift @$after_array;

    pop @$before_array if ( scalar @$before_array > $before );
    unshift @$before_array, $current_record if ( $current_record );
    $current_record = $new_record;
  }

  $this->{'CURRENT_RECORD'} = $current_record;
  pop @$before_array if ( scalar @$before_array > $before );

  if ( !$current_record ) {
    return 1;
  }
  $this->{'CURRENT_RECORD'} = $current_record;

  return $this->run_record_with_context($current_record, $before_array, $after_array);
}

sub stream_done {
  my $this = shift;

  my $after_array    = $this->{'AFTER_ARRAY'};

  if ( scalar @$after_array > 0 ) {
    my $before         = $this->{'BEFORE'};
    my $before_array   = $this->{'BEFORE_ARRAY'};
    my $current_record = $this->{'CURRENT_RECORD'};

    while ( scalar @$after_array ) {
      my $new_record = shift @$after_array;
      unshift @$before_array, $current_record if ( $current_record );
      $current_record = $new_record;

      pop @$before_array if ( scalar @$before_array > $before );

      $this->run_record_with_context($current_record, $before_array, $after_array);
    }
  }

  $this->{'EXECUTOR'}->execute_method('post_xform');
  $this->handle_spools();
}

sub run_record_with_context {
  my $this   = shift;
  my $record = shift;
  my $before = shift;
  my $after  = shift;

  my $value = $this->run_xform_with_record($record, $before, $after);

  if ( ! $this->{'SUPPRESS_R'} ) {
    if ( ref($value) eq 'ARRAY' ) {
      foreach my $new_record (@$value) {
        if ( ref($new_record) eq 'HASH' ) {
          $this->push_record(App::RecordStream::Record->new($new_record));
        }
        else {
          $this->push_record($new_record);
        }
      }
    }
    else {
      $this->push_record($value);
    }
  }

  return $this->handle_spools();
}

sub has_spooled_data {
  my $this = shift;
  return (scalar @{$this->{'SPOOLED_INPUT'}} > 0) || (scalar @{$this->{'SPOOLED_OUTPUT'}} > 0);
}

sub handle_spools {
  my $this = shift;

  $this->{'SUPPRESS_R'} = 0;

  while ( @{$this->{'SPOOLED_OUTPUT'}} ) {
    my $new_record = shift @{$this->{'SPOOLED_OUTPUT'}};
    if ( ref($new_record) eq 'HASH' ) {
      $new_record = App::RecordStream::Record->new($new_record);
    }

    $this->push_record($new_record);
  }

  while ( @{$this->{'SPOOLED_INPUT'}} ) {
    my $new_record = shift @{$this->{'SPOOLED_INPUT'}};
    if ( ref($new_record) eq 'HASH' ) {
      $new_record = App::RecordStream::Record->new($new_record);
    }

    if (! $this->accept_record($new_record) ) {
      #we've requested a stop, clear the input and return 0
      $this->{'SPOOLED_INPUT'} = [];
      return 0;
    }
  }

  return 1;
}

sub run_xform_with_record {
  my $this   = shift;
  my $record = shift;
  my $before = shift;
  my $after  = shift;

  if ( $before ) {
    $before = [@$before];
    $after = [@$after];
  }

  # Must copy before and after due to autovivification in the case of:
  # {{after}} = $A->[0]->{'foo'}
  # (which is unintintional vivification into the array in stream_done)
  return $this->{'XFORM_REF'}->(
    $record, 
    App::RecordStream::Operation::get_current_filename(),
    $before,
    $after,
  );
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('snippet');
  $this->use_help_type('keyspecs');
}

sub usage {
  my $this = shift;

  my $options = [
    App::RecordStream::Executor::options_help(),
    ['A NUM', 'Make NUM records after this one available in $A (closest record to current in first position)'],
    ['B NUM', 'Make NUM records before this one available in $B (closest record to current in first position)'],
    ['C NUM', 'Make NUM records after this one available in $A and $B, as per -A NUM and -B NUM'],
    ['post-snippet SNIP', 'A snippet to run once the stream has completed'],
    ['pre-snippet SNIP', 'A snippet to run before the stream starts'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-xform <args> <expr> [<files>]
   __FORMAT_TEXT__
   <expr> is evaluated as perl on each record of input (or records from
   <files>) with \$r set to a App::RecordStream::Record object and \$line set to the current
   line number (starting at 1).  All records are printed back out (changed as
   they may be).

   If \$r is set to an ARRAY ref in the expr, then the values of the array will
   be treated as records and outputed one to a line.  The values of the array
   may either be a hash ref or a App::RecordStream::Record object.  The
   original record will not be outputted in this case.

   There are two helper methods: push_input and push_output.  Invoking
   push_input on a Record object or hash will cause the next record to be
   processed to be the indicated record.  You may pass multiple records with
   one call.  Similarly push_output causes the next record to be output to be
   the passed record(s).  If push_record is called, the original record will
   not be output in this case. (call push_record(\$r) if you want that record
   also outputted).  You may call these methods from a --pre-snippet or a
   --post-snippet.  You may also call push_output() without any argument to
   suppress the outputting of the current record
   __FORMAT_TEXT__

$args_string

Examples:
   Add line number to records
      recs-xform '\$r->{line} = \$line'
   Rename field old to new, remove field a
      recs-xform '\$r->rename("old", "new"); \$r->remove("a");'
   Remove fields which are not "a", "b", or "c"
      recs-xform '\$r->prune_to("a", "b", "c")'
   Double records
      recs-xform '\$r = [{\%\$r}, {\%\$r}]'
   Double records with function interface
      recs-xform 'push_output(\$r, \$r);'
   Move a value from the previous record to the next record
      recs-xform -B 1 '{{before_val}} = \$B->[0]'
USAGE
}

1;
