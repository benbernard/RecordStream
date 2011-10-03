package App::RecordStream::Operation::chain;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Operation;
use App::RecordStream::Stream::Printer;

use base qw(App::RecordStream::Operation);

sub init {
   my $this = shift;
   my $args = shift;

   my ($show_chain, $dry_run);
   my $spec = {
      'show-chain' => \$show_chain,
      'n'          => sub { $show_chain = 1; $dry_run = 1; },
   };

   Getopt::Long::Configure("require_order");
   $this->parse_options($args, $spec);

   return unless (@$args);

   unless ( App::RecordStream::Operation::is_recs_operation($args->[0]) ) {
     die "First chained command must be standard recs command not shell command!\n";
   }

   $this->{'SAVED_ARGS'} = [@$args] if ( $show_chain );

   if ( $dry_run ) {
      $this->{'DRY_RUN'} = $dry_run;
      return;
   }

   my $operations = $this->create_operations($args);

   my ($first_operation, $last_operation, $continuation_pid) = $this->setup_operations($operations);

   $this->{'CHAIN_HEAD'}        = $first_operation;
   $this->{'CHAIN_TAIL'}        = $last_operation;
   $this->{'CONTINUATION_PID'}  = $continuation_pid;
}

sub print_chain {
   my $this = shift;
   my $args = shift;

   my @current_command;
   my $was_shell = 0;

   $this->push_line("Chain Starts with:");

   my $indent = 1;
   my $last;
   foreach my $arg ( @$args ) {
      if ( $arg eq '|' ) {
         $was_shell = $this->print_command(\@current_command, $last, \$indent);

         $last = [@current_command];
         @current_command = ();
         next;
      }
      push @current_command, $arg;
   }

   $this->print_command(\@current_command, $last, \$indent);
}

sub print_command {
   my $this            = shift;
   my $current_command = shift;
   my $last            = shift;
   my $indent          = shift;

   my $message = '';
   if ( defined $last ) {
      if ( App::RecordStream::Operation::is_recs_operation($last->[0]) && App::RecordStream::Operation::is_recs_operation($current_command->[0]) ) {
         $message .= "Passed in memory to ";
      }
      else {
         $message .= "Passed through a pipe to ";
         $$indent++;
      }
   }

   my $prefix = '  ' x $$indent . $message;

   if ( App::RecordStream::Operation::is_recs_operation($current_command->[0]) ) {
      $this->push_line($prefix . "Recs command: " . join(' ', @$current_command));
      return 0;
   }
   else {
      $this->push_line($prefix . "Shell command: " . join(' ', @$current_command));
      return 1;
   }
}

sub setup_operations {
   my $this       = shift;
   my $operations = shift;

   # others need this
   $operations = [@$operations];

   my ($first_operation, $last_operation, $continuation_pid);
   while ( my $operation = shift @$operations ) {
      if ( $operation->[0] eq 'SHELL' ) {
         my $in_continuation;
         ($in_continuation, $continuation_pid) = $this->setup_fork($operation->[1]);

         if ( $in_continuation ) {
            $first_operation  = undef;
            $last_operation   = undef;
            $continuation_pid = undef;
            next;
         }
         else {
            last;
         }
      }
      elsif ( $operation->[0] eq 'RECS' ) {
         # fall through
      }
      else {
         die;
      }

      $first_operation ||= $operation;
      $last_operation = $operation;
   }

   # we return $continuation_pid so we can wait on it, we can wait on our shell
   # child via close(STDOUT)
   return ($first_operation, $last_operation, $continuation_pid);
}

sub create_operations {
   my $this = shift;
   my $args = shift;

   my @single_command;
   my @operations;
   foreach my $arg ( @$args ) {
      if ( $arg eq '|' ) {
         $this->add_operation(\@single_command, \@operations);
         @single_command = ();
         next;
      }

      push @single_command, $arg;
   }

   $this->add_operation(\@single_command, \@operations);

   return \@operations;
}

sub add_operation {
   my $this           = shift;
   my $single_command = shift;
   my $operations     = shift;

   my $idx = @$operations;
   my $push_shim = App::RecordStream::Operation::chain::PushShim->new($operations, $idx);

   if ( App::RecordStream::Operation::is_recs_operation($single_command->[0]) ) {
      my ($sc1, @args) = @$single_command;
      my $operation = App::RecordStream::Operation::create_operation($sc1, \@args, $push_shim);
      push @$operations, ['RECS', $operation, \@args];
   }
   else {
      push @$operations, ['SHELL', [@$single_command]];
   }
}

sub setup_fork {
   my $this              = shift;
   my $command_arguments = shift;

   my $continuation_pid = open(STDOUT, "|-");
   die "cannot fork: $!" unless defined $continuation_pid;

   if ( ! $continuation_pid ) {
      # in continuation
      return 1;
   }

   # in parent, now split off the shell command as well
   my $shell_pid = open(STDOUT, "|-");
   die "cannot fork: $!" unless defined $shell_pid;

   if ( ! $shell_pid ) {
      # the child runs the shell command
      exec (@$command_arguments);
   }

   # still in parent, we're responsible for the children so we keep the PID
   # around (shell pid can be waited for via close(STDOUT)).
   return (0, $continuation_pid);
}

sub wants_input {
   return 0;
}

sub stream_done {
   my $this = shift;

   if ( my $args = $this->{'SAVED_ARGS'} ) {
      $this->print_chain($args);
   }

   if ( $this->{'DRY_RUN'} ) {
      return;
   }

   my $head = $this->{'CHAIN_HEAD'};

   if ( $head ) {
      my $head_operation = $head->[1];
      my $head_args = $head->[2];
      if ( $head_operation->wants_input() ) {
         local @ARGV = @$head_args;
         while(my $line = <>) {
            chomp $line;
            App::RecordStream::Operation::set_current_filename($ARGV);
            if ( ! $head_operation->accept_line($line) ) {
                last;
            }
         }
      }
      $head_operation->finish();
   }
   else {
      while(<>) {
        chomp;
        $this->push_line($_);
      }
   }

   # wait for shell child (if we even have one)
   close(STDOUT);

   # wait for possible other child (next sequence of recs operations)
   my $continuation_pid = $this->{'CONTINUATION_PID'};
   if ( $continuation_pid ) {
      # We have recs operation processes wait for the next recs operation
      # process to the "right" in the chain.  so that the left-most is last to
      # exit.  The shell is waiting on this left-most process to exit so this
      # exit order ensures everyone finishes up before the shell notice the
      # left-most PID is done and resumes control.
        waitpid $continuation_pid, 0;
   }
   else {
      # no next sequence, we must be the last sequence of recs operations
   }

}

sub get_exit_value {
   my $this = shift;

   if ( my $tail = $this->{'CHAIN_TAIL'} ) {
      return $tail->[1]->get_exit_value();
   }

   return 0;
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
}

sub usage {
   my $this = shift;

   my $options = [
      ['show-chain', 'Before running the commands, print out what will happen in the chain'],
      ['n', 'Do not run commands, implies --show-chain'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-chain <command> | <command> | ...
   __FORMAT_TEXT__
   Creates an in-memory chain of recs operations.  This avoid serialization and
   deserialization of records at each step in a complex recs pipeline.  For
   ease of use the chain of recs commands main contain non-recs command,
   anything that does not start with a recs- is interpreted as a shell command.
   That command is forked off to the shell.  In this case, serialization and
   deserialization costs apply, but only to and from the shell command,
   everything else is done in memory.  If you have many shell commands in a
   row, there is extra over head, you should instead consider splitting those
   into separate pipes.  See the examples for more information on this.

   Arugments are specified in on the command line separated by pipes.  For most
   shells, you will need to escape the pipe character to avoid having the shell
   interpret the pipe as a shell pipe.
   __FORMAT_TEXT__

$args_string

Examples:
   Parse some fields, sort and collate, all in memory
      recs-chain recs-frommultire 'data,time=(\\S+) (\\S+)' \\| recs-sort --key time=n \\| recs-collate --a perc,90,data
   Use shell commands in your recs stream
      recs-chain recs-frommultire 'data,time=(\\S+) (\\S+)' \\| recs-sort --key time=n \\| grep foo \\| recs-collate --a perc,90,data
   Many shell commands should be split into real pipes
      recs-chain recs-frommultire 'data,time=(\\S+) (\\S+)' \\| recs-xform '\$r->{now} = time();' \
        | grep foo | sort | uniq | recs-chain recs-collate --a perc,90,data \\| recs-totable
USAGE
}

package App::RecordStream::Operation::chain::PushShim;

use App::RecordStream::Stream::Base;

use base 'App::RecordStream::Stream::Base';

sub new {
   my $class = shift;
   my $operations = shift;
   my $idx = shift;

   my $this = {
      OPERATIONS => $operations,
      IDX => $idx,
   };

   bless $this, $class;

   return $this;
}

sub accept_record {
   my $this = shift;
   my $record = shift;

   return $this->_get_delegate()->accept_record($record);
}

sub accept_line {
   my $this = shift;
   my $line = shift;

   return $this->_get_delegate()->accept_line($line);
}

sub finish {
   my $this = shift;

   $this->_get_delegate()->finish();
}

sub _get_delegate {
   my $this = shift;

   my $delegate = $this->{'DELEGATE'};

   if ( ! $delegate ) {
      my $operations = $this->{'OPERATIONS'};
      my $idx = $this->{'IDX'};
      if ( $idx + 1 < @$operations ) {
         my $next_operation = $operations->[$idx + 1];
         if ( $next_operation->[0] eq 'RECS' ) {
            # next operation is actually a recs operation, it must be
            # in process with us, give it our output
            $delegate = $next_operation->[1];
         }
         elsif ($next_operation->[0] eq 'SHELL' ) {
            # next is shell, we're set up to print to it
            $delegate = App::RecordStream::Stream::Printer->new();
         }
         else {
            die;
         }
      }
      else {
         # at the end, we print out
         $delegate = App::RecordStream::Stream::Printer->new();
      }

      $this->{'DELEGATE'} = $delegate;
   }

   return $delegate;
}

1;
