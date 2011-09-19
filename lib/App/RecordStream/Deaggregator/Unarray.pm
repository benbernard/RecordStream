package App::RecordStream::Deaggregator::Unarray;

use strict;
use warnings;

use App::RecordStream::Deaggregator::Field;
use App::RecordStream::Deaggregator;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Deaggregator::Field';

sub new
{
   my $class = shift;
   my $old_field = shift;
   my $new_field = shift;

   my $this = $class->SUPER::new($old_field);

   $this->{'new_field'} = $new_field;

   return $this;
}

sub new_from_valuation
{
   my $class = shift;
   my $valuation = shift;
   my $new_field = shift;

   my $this = $class->SUPER::new_from_valuation($valuation);

   $this->{'new_field'} = $new_field;

   return $this;
}

sub deaggregate_field
{
    my $this = shift;
    my $values = shift;

    my @ret;

    for my $value (@$values)
    {
        push @ret, {$this->{'new_field'} => $value};
    }

    return \@ret;
}

sub long_usage
{
   print "Usage: unarray,<old field>,<new field>\n";
   print "   Split the array into individual \"element\" records\n";
   exit 1;
}

sub short_usage
{
   return "split the provided array";
}

sub argct
{
   return 2;
}

App::RecordStream::Deaggregator::register_deaggregator('unarray', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'unarray', 'VALUATION', 'SCALAR');

1;
