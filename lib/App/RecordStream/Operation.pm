package App::RecordStream::Operation;

our $VERSION = "3.4";

use strict;
use warnings;

use Carp;
use FindBin qw($Script $RealScript);
use Getopt::Long;

use App::RecordStream::DomainLanguage;
use App::RecordStream::Executor;
use App::RecordStream::KeyGroups;
use App::RecordStream::Site;
use App::RecordStream::Stream::Base;
use App::RecordStream::Stream::Printer;

use base 'App::RecordStream::Stream::Base';

sub usage {
   subclass_should_implement(shift);
}

sub new {
   my $class    = shift;
   my $args     = shift;
   my $next     = shift;

   my $this = {
      NEXT => $next,
   };

   bless $this, $class;

   $this->init_help();
   $this->init($args);
   return $this;
}

sub init_help {
   my $this        = shift;
   $this->{'HELP_TYPES'} = {
      all       => {
         USE         => 0,
         SKIP_IN_ALL => 1,
         CODE        => \&all_help,
         DESCRIPTION => 'Output all help for this script',
      },
      snippet   => {
         USE         => 0,
         SKIP_IN_ALL => 0,
         CODE        => \&snippet_help,
         DESCRIPTION => 'Help on code snippets',
      },
      keygroups => {
         USE         => 0,
         SKIP_IN_ALL => 0,
         CODE        => \&keygroups_help,
         DESCRIPTION => 'Help on keygroups, a way of specifying multiple keys',
      },
      keyspecs  => {
         USE         => 0,
         SKIP_IN_ALL => 0,
         CODE        => \&keyspecs_help,
         DESCRIPTION => 'Help on keyspecs, a way to index deeply and with regexes',
      },
      basic     => {
         USE         => 1,
         SKIP_IN_ALL => 0,
         CODE        => \&basic_help,
         OPTION_NAME => 'help',
         DESCRIPTION => 'This help screen',
      },
      'keys'    => {
         USE         => 0,
         SKIP_IN_ALL => 1,
         CODE        => \&keys_help,
         DESCRIPTION => 'Help on keygroups and keyspecs',
      },
      domainlanguage => {
         USE         => 0,
         SKIP_IN_ALL => 0,
         CODE        => \&domainlanguage_help,
         DESCRIPTION => 'Help on the recs domain language, a [very complicated] way of specifying valuations (which act like keys) or aggregators',
      },
   };

   $this->add_help_types();
}

# this is a hook for subclasses
sub add_help_types {
}

sub use_help_type {
   my $this = shift;
   my $type = shift;

   $this->{'HELP_TYPES'}->{$type}->{'USE'} = 1;
   $this->{'HELP_TYPES'}->{'all'}->{'USE'} = 1;
}

sub add_help_type {
   my $this        = shift;
   my $type        = shift;
   my $action      = shift;
   my $description = shift;
   my $skip_in_all = shift;
   my $option_name = shift || 0;

   $this->{'HELP_TYPES'}->{$type} = {
      USE         => 1,
      SKIP_IN_ALL => $skip_in_all,
      CODE        => $action,
      OPTION_NAME => $option_name,
      DESCRIPTION => $description,
   };
}

sub parse_options {
   my $this         = shift;
   my $args         = shift || [];
   my $options_spec = shift || {};

   foreach my $help_type (keys %{$this->{'HELP_TYPES'}}) {
      my $type_info = $this->{'HELP_TYPES'}->{$help_type};
      next unless ( $type_info->{'USE'} );

      my $help_option = $type_info->{'OPTION_NAME'} || 'help-' . $help_type;

      $options_spec->{$help_option} ||= sub {
         $type_info->{'CODE'}->($this);
         exit 1;
      };
   }

   local @ARGV = @$args;
   unless (GetOptions(%$options_spec)) {
      # output usage if there was a problem with option parsing
      $this->_set_wants_help(1);
   }

   @$args = @ARGV;
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

   my $usage = $this->usage();

   #Remove all trailing newlines
   while (chomp $usage > 0) {}

   print $usage . "\n\n";
   print "Help Options:\n";
   my $max_length = 0;
   foreach my $type (sort keys %{$this->{'HELP_TYPES'}}) {
      my $info = $this->{'HELP_TYPES'}->{$type};
      next unless ( $info->{'USE'} );
      my $option_name = $info->{'OPTION_NAME'} || "help-$type";
      my $length      = length($option_name);
      $max_length     = $length if ( $max_length < $length );
   }

   $max_length += 2;

   foreach my $type (sort keys %{$this->{'HELP_TYPES'}}) {
      my $info = $this->{'HELP_TYPES'}->{$type};
      next unless ( $info->{'USE'} );

      my $option_name = $info->{'OPTION_NAME'} || "help-$type";
      my $description = $info->{'DESCRIPTION'};

      my $length       = length($option_name);
      my $spaces_count = $max_length - $length;
      my $padding      = ' ' x $spaces_count;

      print "   --$option_name$padding$description\n";
   }
}

sub init {
}

# subclasses can override to indicate they'll handle their own extra
# args and input in stream_done()
sub wants_input {
   return 1;
}

sub finish {
   my $this = shift;
   $this->stream_done();
   $this->{'NEXT'}->finish();
}

{
  my $filename;
  sub get_current_filename {
    return $filename || 'NONE';
  }

  sub set_current_filename {
    my $name = shift;
    $filename = $name;
  }
}

sub subclass_should_implement {
   my $this = shift;
   croak "Subclass should implement: " . ref($this);
}

sub stream_done {
}

sub push_record {
   my ($this, $record) = @_;
   $this->{'NEXT'}->accept_record($record);
}

sub push_line {
   my ($this, $line) = @_;
   $this->{'NEXT'}->accept_line($line);
}

sub load_operation {
   my $script = shift;

   my $operation = $script;

   die "Script not named recs-*: $script" unless ( $script =~ s/^recs-// );

   my @modules = ("App::RecordStream::Operation::$script");
   App::RecordStream::Site::bootstrap();
   my @sites = sort { $a->{'priority'} <=> $b->{'priority'} } App::RecordStream::Site::list_sites();
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
  my $script = shift;

  if ( $script =~ m/^recs-/ ) {
    eval { load_operation($script) };
    return 0 if ( $@ );
    return 1;
  }

  return 0;
}

sub create_operation {
   my $script = shift;
   my $args   = shift;
   my $next   = shift || App::RecordStream::Stream::Printer->new();

   my $module = load_operation($script);

   my $op;
   eval {
      $op = $module->new($args, $next);
   };

   if ( $@ || $op->get_wants_help() ) {
      if ( ! $op ) {
         $op = bless {}, $module;
         $op->init_help();
      }
      $op->print_usage($@);
      exit 1;
   }

   return $op;
}

sub basic_help {
   my $this = shift;
   $this->print_usage($@);
}

sub all_help {
   my $this = shift;

   foreach my $type (sort keys %{$this->{'HELP_TYPES'}}) {
      my $info = $this->{'HELP_TYPES'}->{$type};
      next if ( $info->{'SKIP_IN_ALL'} );
      next if ( !$info->{'USE'} );

      $info->{'CODE'}->($this);
      print "\n"
   }
}

sub keys_help {
   my $this = shift;
   $this->keyspecs_help();
   print "\n";
   $this->keygroups_help();
}

sub snippet_help {
   my $this = shift;
   print App::RecordStream::Executor::usage();
}

sub keyspecs_help {
   my $this = shift;
   print App::RecordStream::Record::keyspec_help();
}

sub keygroups_help {
   my $this = shift;
   print App::RecordStream::KeyGroups::usage();
}

sub domainlanguage_help {
   my $this = shift;
   print App::RecordStream::DomainLanguage::usage();
}

# A static method for a single-line operation bootstrap.  Operation wrappers
# can/should be a symlink to recs-operation itself or just this one line: use
# App::RecordStream::Operation; App::RecordStream::Operation::main();
sub main {
  $| = 1;

  if ( $Script eq 'recs-operation' ) {
     print <<MESSAGE;
WARNING!
recs-operation invoked directly!

recs-operation is a wrapper for all other recs commands.  You do not want to
use this script.  It uses the App::RecordStream::Operation::* modules to performation
operations, like recs-grep.  If you are looking for implementation of those
scripts, look in those modules.  Otherwise, use a different recs script like
recs-grep or recs-collate directly.

Terminating program.
MESSAGE
     exit 1;
  }

  my @args = @ARGV;
  @ARGV = ();

  my $op = App::RecordStream::Operation::create_operation($Script, \@args);

  if ( $op->wants_input() ) {
    @ARGV = @args;
    while(my $line = <>) {
      chomp $line;
      App::RecordStream::Operation::set_current_filename($ARGV);
      if ( ! $op->accept_line($line) ) {
          last;
      }
    }
  }
  $op->finish();

  exit $op->get_exit_value();
}

1;
