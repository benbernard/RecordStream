package App::RecordStream::Deaggregator::Split;

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
   my $delim = shift;
   my $new_field = shift;

   my $this = $class->SUPER::new($old_field);

   $this->{'delim'} = make_delim($delim);
   $this->{'new_field'} = $new_field;

   return $this;
}

sub new_from_valuation
{
   my $class = shift;
   my $valuation = shift;
   my $delim = shift;
   my $new_field = shift;

   my $this = $class->SUPER::new_from_valuation($valuation);

   $this->{'delim'} = $delim; # not make_delim, let the domain language sort it out!
   $this->{'new_field'} = $new_field;

   return $this;
}

sub make_delim
{
    my $delim = shift;

    if($delim =~ /^\/(.*)\/$/)
    {
        return qr/$1/;
    }
    elsif($delim =~ /^\/(.*)\/i$/)
    {
        return qr/$1/i;
    }
    else
    {
        return qr/\Q$delim\E/;
    }
}

sub deaggregate_field
{
    my $this = shift;
    my $values = shift;

    my @ret;

    for my $value (split($this->{'delim'}, $values, -1))
    {
        push @ret, {$this->{'new_field'} => $value};
    }

    return \@ret;
}

sub long_usage
{
   print "Usage: split,<old field>,<delimiter>,<new field>\n";
   print "   Split the old field to create a new one.\n";
   exit 1;
}

sub short_usage
{
   return "split the provided field";
}

sub argct
{
   return 3;
}

App::RecordStream::Deaggregator::register_deaggregator('split', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'split', 'VALUATION', 'SCALAR', 'SCALAR');

1;
