package Recs::Operation;

use strict;
use warnings;

use Carp;
use FindBin qw($Script $RealScript);
use Getopt::Long;
use Recs::InputStream;
use Recs::Site;

sub accept_record {
   subclass_should_implement(shift);
}

sub usage {
   subclass_should_implement(shift);
}

sub new {
   my $class = shift;
   my $args  = shift;

   my $this = {
   };

   bless $this, $class;

   $this->init($args);
   return $this;
}

sub parse_options {
   my $this         = shift;
   my $args         = shift || [];
   my $options_spec = shift || {};

   $options_spec->{'help'} ||= sub { $this->_set_wants_help(1); };

   local @ARGV = @$args;
   GetOptions(%$options_spec);

   $this->_set_extra_args(\@ARGV);
}

sub _set_wants_help {
   my $this = shift;
   my $help = shift;

   $this->{'WANTS_HELP'} = $help;
}

sub get_wants_help {
   my $this = shift;
   return $this->{'WANTS_HELP'};
}

sub _set_exit_value {
   my $this  = shift;
   my $value = shift;

   $this->{'EXIT_VALUE'} = $value;
}

sub get_exit_value {
   my $this = shift;
   return $this->{'EXIT_VALUE'} || 0;
}

sub print_usage {
   my $this    = shift;
   my $message = shift;

   if ( $message ) {
      print "$message\n";
   }

   print $this->usage();
   exit 1;
}

sub init {
}

sub finish {
   my $this = shift;
   $this->stream_done();
   $this->_get_next_operation()->finish();
}

sub get_input_stream {
   my $this = shift;
   $this->{'INPUT_STREAM'} ||= Recs::InputStream->new_magic($this->_get_extra_args());
   return $this->{'INPUT_STREAM'};
}

sub set_input_stream {
   my $this   = shift;
   my $stream = shift;
   $this->{'INPUT_STREAM'} = $stream;
}

sub run_operation {
   my $this = shift;

   my $input = $this->get_input_stream(); 

   while ( my $record = $input->get_record() ) {
      $this->accept_record($record);
      last if ( $this->should_stop() );
   }
}

sub should_stop {
  return 0;
}

sub subclass_should_implement {
   my $this = shift;
   croak "Subclass should implement: " . ref($this);
}

sub stream_done {
}

sub push_record {
   my $this   = shift;
   my $record = shift;

   $this->_get_next_operation()->accept_record($record);
}

sub _get_next_operation {
   my $this = shift;

   unless ( $this->{'NEXT'} ) {
      require Recs::Operation::Printer;
      $this->{'NEXT'} = Recs::Operation::Printer->new();
   }

   return $this->{'NEXT'};
}

sub load_operation {
   my $class  = shift;
   my $script = shift;

   my $operation = $script;

   die "Script not named recs-*: $script" unless ( $script =~ s/^recs-// );

   my @modules = ("Recs::Operation::$script");
   Recs::Site::bootstrap();
   my @sites = sort { $a->{'priority'} <=> $b->{'priority'} } Recs::Site::list_sites();
   for my $site (@sites)
   {
      unshift @modules, $site->{'path'} . "::Operation::$script";
   }

   my $module;
   my @errors;
   for my $try_module (@modules)
   {
      eval "require $try_module";
      if($@) {
         push @errors, "Could not load $try_module: $@";
      }
      else {
         $module = $try_module;
         last;
      }
   }
   if(!$module) {
      die "Could not find operation $script:\n" . join("", @errors);
   }

   return $module;
}

sub is_recs_operation {
  my $class = shift;
  my $script = shift;

  if ( $script =~ m/^recs-/ ) {
    eval { $class->load_operation($script) };
    return 0 if ( $@ );
    return 1;
  }

  return 0;
}

sub create_operation {
   my $class  = shift;
   my $script = shift;
   my @args   = @_;

   my $module = $class->load_operation($script);

   my $op;
   eval {
      $op = $module->new(\@args);
   };

   if ( $@ || $op->get_wants_help() ) {
      ($op || $module)->print_usage($@);
   }

   return $op;
}

sub _set_next_operation {
   my $this = shift;
   my $next = shift;

   $this->{'NEXT'} = $next;
}

sub _set_extra_args {
   my $this = shift;
   my $args = shift;

   $this->{'EXTRA_ARGS'} = $args;
}

sub _get_extra_args {
   my $this = shift;
   return $this->{'EXTRA_ARGS'};
}

# A static method for a single-line operation bootstrap.  Operation wrappers
# can/should be a symlink to recs-operation itself or just this one line: use
# Recs::Operation; Recs::Operation::main();
sub main {
  $| = 1;

  if ( $Script eq 'recs-operation' ) {
     print <<MESSAGE;
WARNING!
recs-operation invoked directly!

recs-operation is a wrapper for all other recs commands.  You do not want to
use this script.  It uses the Recs::Operation::* modules to performation
operations, like recs-grep.  If you are looking for implementation of those
scripts, look in those modules.  Otherwise, use a different recs script like
recs-grep or recs-collate directly.

Terminating program.
MESSAGE
     exit 1;
  }

  my @args = @ARGV;
  @ARGV = ();

  my $op = Recs::Operation->create_operation($Script, @args);

  $op->run_operation();
  $op->finish();

  exit $op->get_exit_value();
}

1;
