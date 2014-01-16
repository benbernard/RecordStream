package App::RecordStream::Operation::fromps;

our $VERSION = "4.0.1";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::OptionalRequire qw(Proc::ProcessTable);
App::RecordStream::OptionalRequire::require_done();

sub init {
  my $this = shift;
  my $args = shift;

  my $process_table = $this->get_process_table();

  my @fields;

  my $spec = {
    'key|k|field|f=s' => sub { push @fields, split(',', $_[1]) },
  };

  $this->parse_options($args, $spec);

  if ( scalar @fields < 1 ) {
    # Silly Proc::ProcessTable has been known to give undefs sometimes for some
    # reason.  We throw them on the ground.
    @fields = grep { defined($_) } $process_table->fields();
  }

  $this->{'FIELDS'}        = \@fields;
}

sub get_process_table {
  my $this = shift;
  $this->{'PROCESS_TABLE'} ||= Proc::ProcessTable->new();
  return $this->{'PROCESS_TABLE'}
}

sub set_process_table {
  my $this = shift;
  my $table = shift;
  $this->{'PROCESS_TABLE'} = $table;
}

sub set_converter {
  my $this = shift;
  my $func = shift;
  $this->{'CONVERTER'} = $func;
}

sub get_converter {
  my $this = shift;
  $this->{'CONVERTER'} ||= sub { return (getpwuid($_[0]))[0] };
  return $this->{'CONVERTER'};
}

sub wants_input {
  return 0;
}

sub stream_done {
  my $this = shift;

  my $table  = $this->get_process_table();
  my $fields = $this->{'FIELDS'};

  foreach my $proc (@{$table->table()}) {
    my $record = App::RecordStream::Record->new();
    foreach my $field (@$fields) {
      my $value = $proc->{$field};

      if ( $field eq 'uid' ) {
        $value = $this->get_converter()->($value);
      }

      $record->{$field} = $value if ( defined $value );
    }

    $this->push_record($record);
  }
}

sub usage {
  my $this = shift;

  my @fields = Proc::ProcessTable->new()->fields();
  my $all_fields = join (', ', @fields);

  my $options = [
    [ 'keys <fields>', 'Fields to output.  May be specified multiple times, may be comma separated.  Default to all fields These are Proc::ProcessTable keys, and thus may not be keyspecs or groups'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-fromps <args>
   __FORMAT_TEXT__
   Prints out JSON records converted from the process table.
   __FORMAT_TEXT__

$args_string

Default fields:
   __FORMAT_TEXT__
   $all_fields
   __FORMAT_TEXT__

Examples:
   Get records for the process table
      recs-fromps
   Only get uid and pid
      recs-fromps --keys uid,pid
USAGE
}

1;
