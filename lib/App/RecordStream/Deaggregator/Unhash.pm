package App::RecordStream::Deaggregator::Unhash;

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
   my $new_key_field = shift;
   my $new_value_field = shift;

   my $this = $class->SUPER::new($old_field);

   $this->{'new_key_field'} = $new_key_field;
   $this->{'new_value_field'} = $new_value_field;

   return $this;
}

sub new_from_valuation
{
   my $class = shift;
   my $valuation = shift;
   my $new_key_field = shift;
   my $new_value_field = shift;

   my $this = $class->SUPER::new_from_valuation($valuation);

   $this->{'new_key_field'} = $new_key_field;
   $this->{'new_value_field'} = $new_value_field;

   return $this;
}

sub deaggregate_field
{
    my $this = shift;
    my $hashref = shift;

    my @ret;

    for my $key (sort(keys(%$hashref)))
    {
        my $record = {};
        $record->{$this->{'new_key_field'}} = $key;
        if(defined($this->{'new_value_field'}))
        {
            $record->{$this->{'new_value_field'}} = $hashref->{$key};
        }
        push @ret, $record;
    }

    return \@ret;
}

sub long_usage
{
   print "Usage: unhash,<old field>,<new key field>[,<new value field>]\n";
   print "   Split the hash into key/value \"pair\" records\n";
   exit 1;
}

sub short_usage
{
   return "split the provided hash";
}

sub argct
{
   return [2, 3];
}

App::RecordStream::Deaggregator::register_deaggregator('unhash', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'unhash', 'VALUATION', 'SCALAR');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'unhash', 'VALUATION', 'SCALAR', 'SCALAR');

1;
