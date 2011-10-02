package App::RecordStream::DomainLanguage::Value;

use strict;
use warnings;

use App::RecordStream::Aggregator::Internal::Constant;
use App::RecordStream::DomainLanguage::Snippet;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;
use App::RecordStream::DomainLanguage::Valuation::Sub;
use Scalar::Util ('blessed');

sub new
{
    my $class = shift;
    my $desc = shift;

    my $this =
    {
        'DESCRIPTION' => $desc,
        'POSSIBILITIES' => {},
    };

    bless $this, $class;

    return $this;
}

sub new_from_scalar
{
    my $class = shift;
    my $value = shift;

    my $this = $class->new("scalar($value)");

    $this->add_possibility('SCALAR', $value);

    return $this;
}

sub add_possibility
{
    my $this = shift;
    my $type = shift;
    my $value = shift;

    push @{$this->{'POSSIBILITIES'}->{$type} ||= []}, $value;

    # sketchy upgrade...
    if($type eq "SCALAR")
    {
        $this->add_possibility('VALUATION', App::RecordStream::DomainLanguage::Valuation::KeySpec->new($value));
        $this->add_possibility('SNIPPET', App::RecordStream::DomainLanguage::Snippet->new($value));
    }
}

sub get_possibilities
{
    my $this = shift;
    my $type = shift;

    return @{$this->{'POSSIBILITIES'}->{$type} || []};
}

sub get_possible_pairs
{
    my $this = shift;

    my @ret;
    for my $type (keys(%{$this->{'POSSIBILITIES'}}))
    {
        for my $value (@{$this->{'POSSIBILITIES'}->{$type}})
        {
            push @ret, [$type, $value];
        }
    }

    return @ret;
}

sub get_description
{
    my $this = shift;

    return $this->{'DESCRIPTION'};
}

sub _force
{
    my $this = shift;
    my $type = shift;

    my $ar = $this->{'POSSIBILITIES'}->{$type} || [];
    my $ct = @$ar;
    if($ct != 1)
    {
        die "Cannot use '" . $this->{'DESCRIPTION'} . "' as $type, $ct possibilities";
    }

    return $ar->[0];
}

# TODO: amling, fake isa?
# TODO: amling, make sure we have all methods from aggregator (returns_record?)

# We can pretend to be an aggregator in a pinch

sub initial
{
    return shift->_force('AGGREGATOR')->initial(@_);
}

sub combine
{
    return shift->_force('AGGREGATOR')->combine(@_);
}

sub squish
{
    return shift->_force('AGGREGATOR')->squish(@_);
}

# We can pretend to be a deaggregator in a pinch

sub deaggregate
{
    return shift->_force('DEAGGREGATOR')->deaggregate(@_);
}

# We can pretend to be a valuation in a pinch

sub evaluate_record
{
    return shift->_force('VALUATION')->evaluate_record(@_);
}

sub cast_or_die
{
    my $type = shift;
    my $obj = shift;

    if($type eq 'AGGREGATOR')
    {
        return cast_agg_or_die($obj);
    }
    elsif($type eq 'DEAGGREGATOR')
    {
        return cast_deagg_or_die($obj);
    }
    elsif($type eq 'VALUATION')
    {
        return cast_valuation_or_die($obj);
    }
    elsif($type eq 'SCALAR')
    {
        return cast_scalar_or_die($obj);
    }
    else
    {
        die "Bad type $type?";
    }
}

sub cast_valuation_or_die
{
    my $obj = shift;

    if(ref($obj) && ref($obj) eq "CODE")
    {
        return App::RecordStream::DomainLanguage::Valuation::Sub->new($obj);
    }

    if(blessed($obj) && $obj->isa('App::RecordStream::DomainLanguage::Value'))
    {
        my @val = $obj->get_possibilities('VALUATION');
        if(@val > 1)
        {
            die "Multiple valuations for " . $obj->get_description();
        }
        if(@val == 1)
        {
            return $val[0];
        }
    }

    if(blessed($obj) && $obj->isa('App::RecordStream::Aggregator::Aggregation'))
    {
        die "Aggregation found where valuation expected";
    }

    if(blessed($obj) && $obj->isa('App::RecordStream::DomainLanguage::Valuation'))
    {
        return $obj;
    }

    die "Unknown found where valuation expected";
}

sub cast_agg_or_die
{
    my $obj = shift;

    if(blessed($obj) && $obj->isa('App::RecordStream::DomainLanguage::Value'))
    {
        my @agg = $obj->get_possibilities('AGGREGATOR');
        if(@agg > 1)
        {
            die "Multiple aggregators for " . $obj->get_description();
        }
        if(@agg == 1)
        {
            return $agg[0];
        }

        my @scalar = $obj->get_possibilities('SCALAR');
        if(@scalar > 1)
        {
            die "No aggregators and multiple scalars for " . $obj->get_description();
        }
        if(@scalar == 1)
        {
            $obj = $scalar[0];
        }
        else
        {
            die "No usable possibilities for " . $obj->get_description();
        }
    }

    if(blessed($obj) && $obj->isa('App::RecordStream::Aggregator::Aggregation'))
    {
        return $obj;
    }

    if(blessed($obj) && $obj->isa('App::RecordStream::DomainLanguage::Valuation'))
    {
        die "Valuation found where aggregator expected";
    }

    # running out of ideas here
    return App::RecordStream::Aggregator::Internal::Constant->new($obj);
}

sub cast_deagg_or_die
{
    my $obj = shift;

    if(blessed($obj) && $obj->isa('App::RecordStream::DomainLanguage::Value'))
    {
        my @deagg = $obj->get_possibilities('DEAGGREGATOR');
        if(@deagg > 1)
        {
            die "Multiple deaggregators for " . $obj->get_description();
        }
        if(@deagg == 1)
        {
            return $deagg[0];
        }

        die "No usable possibilities for " . $obj->get_description();
    }

    if(blessed($obj) && $obj->isa('App::RecordStream::Deaggregator::Base'))
    {
        return $obj;
    }

    if(blessed($obj) && $obj->isa('App::RecordStream::DomainLanguage::Valuation'))
    {
        die "Valuation found where aggregator expected";
    }

    die "Could not turn unknown into a deaggregator";
}

sub cast_scalar_or_die
{
    my $obj = shift;

    if(blessed($obj) && $obj->isa('App::RecordStream::DomainLanguage::Value'))
    {
        my @scalar = $obj->get_possibilities('SCALAR');
        if(@scalar > 1)
        {
            die "Multiple scalar values for " . $obj->get_description();
        }
        if(@scalar == 1)
        {
            return $scalar[0];
        }

        die "No scalar possibilities for " . $obj->get_description();
    }

    if(blessed($obj) && $obj->isa('App::RecordStream::Aggregator::Aggregation'))
    {
        die "Aggregator found where scalar expected";
    }

    if(blessed($obj) && $obj->isa('App::RecordStream::DomainLanguage::Valuation'))
    {
        die "Valuation found where scalar expected";
    }

    return $obj;
}

1;
