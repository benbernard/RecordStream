package App::RecordStream::Test::OperationHelper;

our $VERSION = "3.4";

use strict;
use warnings;

use Test::More;
use App::RecordStream::InputStream;
use App::RecordStream::OutputStream;

sub new {
   my $class = shift;
   my %args  = @_;

   my $this = {
      INPUT     => create_stream($args{'input'}),
      OUTPUT    => create_stream($args{'output'}),
      OPERATION => $args{'operation'},
      KEEPER    => $args{'keeper'},
   };

   bless $this, $class;

   return $this;
}

sub create_stream {
   my $input = shift;

   return undef unless ( $input );
   return $input if ( ref($input) eq 'ARRAY' );

   if ( UNIVERSAL::isa($input, 'App::RecordStream::InputStream') ) {
      return $input;
   }

   if ( (not ($input =~ m/\n/m))  && -e $input ) {
      return App::RecordStream::InputStream->new(FILE => $input);
   }

   return App::RecordStream::InputStream->new(STRING => $input);
}

sub matches {
   my $this = shift;
   my $name = shift || 'unnamed';

   my $op     = $this->{'OPERATION'};
   my $input  = $this->{'INPUT'};

   if ( $op->wants_input() && $input ) {
     if ( ref($input) eq 'ARRAY' ) {
       my ($t, @v) = @$input;
       if ( $t eq 'LINES' ) {
         for my $l (@v) {
           if ( ! $op->accept_line($l) ) {
             last;
           }
         }
       }
       elsif ( $t eq 'FILES' ) {
         local @ARGV = @v;
         while(my $l = <>) {
           App::RecordStream::Operation::set_current_filename($ARGV);
           chomp $l;
           if ( ! $op->accept_line($l) ) {
             last;
           }
         }
       }
       else {
         die;
       }
     }
     else {
       App::RecordStream::Operation::set_current_filename($input->get_filename());
       while ( my $r = $input->get_record() ) {
         if ( ! $op->accept_record($r) ) {
           last;
         }
       }
     }
   }
   $op->finish();

   my $output  = $this->{'OUTPUT'};
   my $results = $this->{'KEEPER'}->get_records();
   my $i = 0;

   #ok(0, "DIE");
   my @output_records;
   if ( $output ) {
      while ( my $record = $output->get_record() ) {
         push @output_records, $record;
      }
   }

   my $is_ok = 1;
   for my $record (@$results) {
      $is_ok = 0 if ( ! ok(UNIVERSAL::isa($record, 'App::RecordStream::Record'), "Record is a App::RecordStream::Record") );
   }

   $is_ok = 0 if ( ! is_deeply($results, \@output_records, "Records match: $name") );

   $is_ok = 0 if ( ! ok($this->{'KEEPER'}->has_called_finish(), "Has called finish: $name") );

   if ( ! $is_ok ) {
      warn "Expected and output differed!\nExpected:\n";
      for my $record (@output_records) {
          print STDERR App::RecordStream::OutputStream::hashref_string($record) . "\n";
      }
      warn "Output from module:\n";
      for my $record (@$results) {
          print STDERR App::RecordStream::OutputStream::hashref_string($record) . "\n";
      }
   }

   return $is_ok;
}

sub do_match {
   my $class          = shift;
   my $operation_name = shift;
   my $args           = shift;
   my $input          = shift;
   my $output         = shift;

   my $operation_class = "App::RecordStream::Operation::$operation_name";
   my $keeper = App::RecordStream::Test::OperationHelper::Keeper->new();
   my $op = $operation_class->new($args, $keeper);

   if ( $op->wants_input() && @$args ) {
      if ( $input ) {
         fail("Both extra args [" . join(", ", @$args) . "] and input provided?");
      }
      else {
         $input = ['FILES', @$args];
      }
   }

   ok($op, "Operation initialization");

   my $helper = $class->new(
      operation => $op,
      keeper    => $keeper,
      input     => $input,
      output    => $output,
   );

   $helper->matches();

   return $helper;
}

sub test_output {
   my $class          = shift;
   my $operation_name = shift;
   my $args           = shift;
   my $input          = shift;
   my $output         = shift;

   my $operation_class = "App::RecordStream::Operation::$operation_name";
   my $keeper = App::RecordStream::Test::OperationHelper::Keeper->new();
   my $op = $operation_class->new($args, $keeper);

   ok($op, "Object initialization");

   my $helper = __PACKAGE__->new(
      operation => $op,
      keeper    => $keeper,
      input     => $input,
      output    => '',
   );

   $helper->matches();

   is(join ('', map { "$_\n" } @{$keeper->get_lines()}), $output, "Output matches expected");
}


package App::RecordStream::Test::OperationHelper::Keeper;

use base qw(App::RecordStream::Stream::Base);

sub new {
   my $class = shift;
   my $this = { RECORDS => [], LINES => [] };
   bless $this, $class;
   return $this;
}

sub accept_record {
   my $this = shift;
   my $record = shift;

   push @{$this->{'RECORDS'}}, $record;

   return 1;
}

sub get_records {
   my $this = shift;
   return $this->{'RECORDS'};
}

sub accept_line {
   my $this = shift;
   my $line = shift;

   push @{$this->{'LINES'}}, $line;

   return 1;
}

sub get_lines {
   my $this = shift;
   return $this->{'LINES'};
}

sub has_called_finish {
   my $this = shift;
   return $this->{'CALLED_FINISH'};
}

sub finish {
  my $this = shift;
  $this->{'CALLED_FINISH'} = 1;
}

1;
