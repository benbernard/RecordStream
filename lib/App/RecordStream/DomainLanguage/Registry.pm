package App::RecordStream::DomainLanguage::Registry;

use strict;
use warnings;

use App::RecordStream::DomainLanguage::Value;
use Scalar::Util ('blessed');

my $registry =
{
};

sub new_node
{
    return
    {
        'SUBREF' => undef,
        'EPSILONS' => {},
        'NORMALS' => {},
        'REPEATABLE' => undef,
    };
}

sub register_ctor
{
    my $pkg = shift;
    my $token = shift;
    my @types = @_;

    return register_fn(sub { return $pkg->new(@_) }, $token, @types);
}

sub register_vfn
{
    my $tgt = shift;
    my $meth = shift;
    my $token = shift;
    my @types = @_;

    return register_fn(sub { return $tgt->$meth(@_) }, $token, @types);
}

sub register_fn
{
    my $subref = shift;
    my $token = shift;
    my @types = @_;

    my $p = ($registry->{$token} ||= new_node());

    for my $type (@types)
    {
        if($type =~ /^(.*)\*$/)
        {
            my $raw_type = $1;
            $p = ($p->{'EPSILONS'}->{$raw_type} ||= new_node());
            $p->{'REPEATABLE'} = $raw_type;
        }
        else
        {
            $p = ($p->{'NORMALS'}->{$type} ||= new_node());
        }
    }

    if($p->{'SUBREF'})
    {
        die "Collision in type registry at $token(" . join(", ", @types) . ")";
    }

    $p->{'SUBREF'} = $subref;
}

sub get_tokens
{
    return keys(%$registry);
}

sub evaluate
{
    my $token = shift;
    my @raw_args = @_;

    my @value_args;
    for my $arg (@raw_args)
    {
        if(blessed($arg) && $arg->isa('App::RecordStream::DomainLanguage::Value'))
        {
            push @value_args, $arg;
            next;
        }
        my $value = App::RecordStream::DomainLanguage::Value->new("<raw object>");
        my $done = 0;
        if(blessed($arg) && $arg->isa('App::RecordStream::DomainLanguage::Valuation'))
        {
            $value->add_possibility('VALUATION', $arg);
            $done = 1;
        }
        if(blessed($arg) && $arg->isa('App::RecordStream::Aggregator::Aggregation'))
        {
            $value->add_possibility('AGGREGATOR', $arg);
            $done = 1;
        }
        if($done)
        {
            push @value_args, $value;
            next;
        }

        # uh, no clue, must be a scalar
        push @value_args, App::RecordStream::DomainLanguage::Value->new_from_scalar($arg);
    }

    # now all of @value_args is Value objects
    my @results;
    evaluate_aux(\@results, ($registry->{$token} || {}), [], @value_args);

    my $ret = App::RecordStream::DomainLanguage::Value->new($token . "(" . join(", ", map { $_->get_description() } @value_args) . ")");

    for my $result (@results)
    {
        if(blessed($result) && $result->isa('App::RecordStream::DomainLanguage::Value'))
        {
            for my $pair ($result->get_possible_pairs())
            {
                my ($type, $value) = @$pair;
                $ret->add_possibility($type, $value);
            }
            next;
        }
        my $done = 0;
        if(blessed($result) && $result->isa('App::RecordStream::DomainLanguage::Valuation'))
        {
            $ret->add_possibility('VALUATION', $result);
            $done = 1;
        }
        if(blessed($result) && $result->isa('App::RecordStream::Aggregator::Aggregation'))
        {
            $ret->add_possibility('AGGREGATOR', $result);
            $done = 1;
        }
        if($done)
        {
            next;
        }

        $ret->add_possibility('SCALAR', $result);
    }

    return $ret;
}

sub evaluate_aux
{
    my $results_ref = shift;
    my $registry_pos = shift;
    my $built_args = shift;
    my @values_left = @_;

    for my $type (keys(%{$registry_pos->{'EPSILONS'}}))
    {
        evaluate_aux($results_ref, $registry_pos->{'EPSILONS'}->{$type}, $built_args, @values_left);
    }

    if(!@values_left)
    {
        # this is our stop
        my $subref = $registry_pos->{'SUBREF'};
        if($subref)
        {
            push @$results_ref, $subref->(@$built_args);
        }
        return;
    }

    my $next_value = shift @values_left;

    my $repeatable_type = $registry_pos->{'REPEATABLE'};
    if($repeatable_type)
    {
        for my $arg ($next_value->get_possibilities($repeatable_type))
        {
            push @$built_args, $arg;
            evaluate_aux($results_ref, $registry_pos, $built_args, @values_left);
            pop @$built_args;
        }
    }

    for my $type (keys(%{$registry_pos->{'NORMALS'}}))
    {
        my $registry_pos_next = $registry_pos->{'NORMALS'}->{$type};
        for my $arg ($next_value->get_possibilities($type))
        {
            push @$built_args, $arg;
            evaluate_aux($results_ref, $registry_pos_next, $built_args, @values_left);
            pop @$built_args;
        }
    }
}

1;
