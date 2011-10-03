package App::RecordStream::Operation::decollate;

use strict;
use warnings;

use App::RecordStream::Deaggregator;
use App::RecordStream::DomainLanguage::Library;
use App::RecordStream::DomainLanguage;
use App::RecordStream::Operation;
use App::RecordStream::Record;

use base 'App::RecordStream::Operation';

sub init
{
    my $this = shift;
    my $args = shift;

    App::RecordStream::Deaggregator::load_deaggregators();

    my @deaggregators;
    my @dldeaggregators;
    my $list_deaggregators = 0;
    my $deaggregator = 0;

    my $spec =
    {
        "deaggregator|d=s"    => sub { push @deaggregators, split(/:/, $_[1]); },
        "dldeaggregator=s"    => sub { push @dldeaggregators, build_dldeaggregator($_[1]); },
        "list-deaggregators"  => \$list_deaggregators,
        "show-deaggregator=s" => \$deaggregator,
    };

   $this->parse_options($args, $spec);

   if($list_deaggregators)
   {
       die sub { App::RecordStream::Deaggregator::list_deaggregators(); };
   }

   if($deaggregator)
   {
       die sub { App::RecordStream::Deaggregator::show_deaggregator($deaggregator) };
   }

   my @deaggregator_objects;
   for my $spec (@deaggregators)
   {
       push @deaggregator_objects, App::RecordStream::Deaggregator::make_deaggregator($spec);
   }

   @deaggregator_objects = (@deaggregator_objects, @dldeaggregators);

   $this->{'DEAGGREGATORS'} = \@deaggregator_objects;
}

sub build_dldeaggregator
{
    my $string = shift;

    return App::RecordStream::DomainLanguage::Snippet->new($string)->evaluate_as('DEAGGREGATOR');
}

sub accept_record
{
    my $this = shift;
    my $record = shift;

    $this->accept_record_aux(0, $record);

    return 1;
}

sub accept_record_aux
{
    my $this = shift;
    my $depth = shift;
    my $record = shift;

    if($depth < @{$this->{'DEAGGREGATORS'}})
    {
        my $deaggregator = $this->{'DEAGGREGATORS'}->[$depth];

        for my $deaggregated_record (@{$deaggregator->deaggregate($record)})
        {
            $this->accept_record_aux($depth + 1, App::RecordStream::Record->new({%$record, %$deaggregated_record}));
        }
    }
    else
    {
        $this->push_record($record);
    }
}

sub print_usage
{
    my $this = shift;
    my $message = shift;

    if($message && UNIVERSAL::isa($message, 'CODE')) {
        $message->();
        exit(1);
    }

    $this->SUPER::print_usage($message);
}

sub add_help_types
{
    my $this = shift;
    $this->use_help_type('domainlanguage');
    $this->add_help_type(
        'deaggregators',
        sub { App::RecordStream::Deaggregator::list_deaggregators(); },
        'List the deaggregators'
    );
}

sub usage {
   my $this = shift;

   my $options = [
      [ 'dldeaggregator ...', 'Specify a domain language aggregate.  See "Domain Language Integration" below.'],
      [ 'deaggregator|-d <deaggregators>', 'Colon separated list of aggregate field specifiers.  See "Deaggregates" section below.'],
      [ 'list-deaggregators', 'Bail and output a list of deaggregators.'],
      [ 'show-deaggregator <deaggregator>', 'Bail and output this deaggregator\'s detailed usage.'],
   ];

   my $args_string = $this->options_string($options);
   return <<USAGE
Usage: recs-decollate <args> [<files>]
   __FORMAT_TEXT__
   Decollate records of input (or records from <files>) into output records.
   __FORMAT_TEXT__

Arguments:
$args_string

Deaggregates:
   __FORMAT_TEXT__
   Deaggregates are specified as <deaggregator>[,<arguments>].  See
   --list-deaggregators for a list of available deaggregators.

   In general, key name arguments to deaggregators may be key specs, but not
   key groups
   __FORMAT_TEXT__

Domain Lanuage Integration:
   __FORMAT_TEXT__
USAGE
   . App::RecordStream::DomainLanguage::short_usage()
   . <<USAGE

   Deaggregates may be specified using the recs domain language.
   --dldeaggregator requires the code evaluate as a deaggregator.

   See --help-domainlanguage for a more complete description of its workings
   and a list of available functions.

   See the examples below for a more gentle introduction.
   __FORMAT_TEXT__

Examples:
   Split the "hosts" field into individual "host" fields
      recs-decollate --dldeaggregator '_split(hosts,qr/, */,host)'
USAGE
   ;
}

1;
