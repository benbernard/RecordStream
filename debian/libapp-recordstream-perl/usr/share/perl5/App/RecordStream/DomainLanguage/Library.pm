package App::RecordStream::DomainLanguage::Library;

use strict;
use warnings;

use App::RecordStream::Aggregator::InjectInto::Subrefs;
use App::RecordStream::DomainLanguage::Registry;
use App::RecordStream::DomainLanguage::Snippet;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;
use App::RecordStream::DomainLanguage::Valuation::Sub;
use App::RecordStream::DomainLanguage::Value;

sub _identity
{
    return $_[0];
}

App::RecordStream::DomainLanguage::Registry::register_fn(\&_identity, 'type_agg', 'AGGREGATOR');
App::RecordStream::DomainLanguage::Registry::register_fn(\&_identity, 'type_valuation', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_fn(\&_identity, 'type_scalar', 'SCALAR');

sub _snippet_upgrade
{
    my $snippet = shift;

    my $ret = App::RecordStream::DomainLanguage::Value->new();
    $ret->add_possibility('VALUATION', App::RecordStream::DomainLanguage::Valuation::Sub->new(sub { return $snippet->evaluate_as('SCALAR', {'$r' => $_[0]}); }));
    $ret->add_possibility('SNIPPET', $snippet);
    return $ret;
}

App::RecordStream::DomainLanguage::Registry::register_fn(\&_snippet_upgrade, 'snip', 'SNIPPET');

sub _rec_valuation
{
    return App::RecordStream::DomainLanguage::Valuation::Sub->new(sub { return $_[0]; });
}

App::RecordStream::DomainLanguage::Registry::register_fn(\&_rec_valuation, 'record');
App::RecordStream::DomainLanguage::Registry::register_fn(\&_rec_valuation, 'rec');

sub _raw_valuation
{
    my $v = shift;

    if(ref($v) eq "CODE")
    {
        return App::RecordStream::DomainLanguage::Valuation::Sub->new($v);
    }

    return App::RecordStream::DomainLanguage::Valuation::KeySpec->new($v);
}

App::RecordStream::DomainLanguage::Registry::register_fn(\&_raw_valuation, 'valuation', 'SCALAR');
App::RecordStream::DomainLanguage::Registry::register_fn(\&_raw_valuation, 'val', 'SCALAR');

sub _inject_into_aggregator
{
    my $initial_snippet = shift;
    my $combine_snippet = shift;
    my $squish_snippet = shift || App::RecordStream::DomainLanguage::Snippet->new('$a');

    my $initial_sub = sub
    {
        return $initial_snippet->evaluate_as('SCALAR');
    };

    my $combine_sub = sub
    {
        my $cookie = shift;
        my $record = shift;

        return $combine_snippet->evaluate_as('SCALAR', {'$a' => $cookie, '$r' => $record});
    };

    my $squish_sub = sub
    {
        my $cookie = shift;

        return $squish_snippet->evaluate_as('SCALAR', {'$a' => $cookie});
    };

    return App::RecordStream::Aggregator::InjectInto::Subrefs->new($initial_sub, $combine_sub, $squish_sub);
}

for my $ii_name ('ii', 'inject_into')
{
    for my $agg_name ('agg', 'aggregator')
    {
        App::RecordStream::DomainLanguage::Registry::register_fn(\&_inject_into_aggregator, $ii_name . '_' . $agg_name, 'SNIPPET', 'SNIPPET');
        App::RecordStream::DomainLanguage::Registry::register_fn(\&_inject_into_aggregator, $ii_name . '_' . $agg_name, 'SNIPPET', 'SNIPPET', 'SNIPPET');
    }
}

sub _map_reduce_aggregator
{
    my $map_snippet = shift;
    my $reduce_snippet = shift;
    my $squish_snippet = shift || App::RecordStream::DomainLanguage::Snippet->new('$a');

    my $map_sub = sub
    {
        my $record = shift;

        return $map_snippet->evaluate_as('SCALAR', {'$r' => $record});
    };

    my $reduce_sub = sub
    {
        my $cookie1 = shift;
        my $cookie2 = shift;

        return $reduce_snippet->evaluate_as('SCALAR', {'$a' => $cookie1, '$b' => $cookie2});
    };

    my $squish_sub = sub
    {
        my $cookie = shift;

        return $squish_snippet->evaluate_as('SCALAR', {'$a' => $cookie});
    };

    return App::RecordStream::Aggregator::MapReduce::Subrefs->new($map_sub, $reduce_sub, $squish_sub);
}

for my $mr_name ('mr', 'map_reduce')
{
    for my $agg_name ('agg', 'aggregator')
    {
        App::RecordStream::DomainLanguage::Registry::register_fn(\&_map_reduce_aggregator, $mr_name . '_' . $agg_name, 'SNIPPET', 'SNIPPET');
        App::RecordStream::DomainLanguage::Registry::register_fn(\&_map_reduce_aggregator, $mr_name . '_' . $agg_name, 'SNIPPET', 'SNIPPET', 'SNIPPET');
    }
}

sub _subset_agg
{
    my $match_snippet = shift;
    my $aggregator = shift;

    my $initial_sub = sub
    {
        return $aggregator->initial();
    };

    my $combine_sub = sub
    {
        my $cookie = shift;
        my $record = shift;

        if($match_snippet->evaluate_as('SCALAR', {'$r' => $record}))
        {
            $cookie = $aggregator->combine($cookie, $record);
        }

        return $cookie;
    };

    my $squish_sub = sub
    {
        my $cookie = shift;

        return $aggregator->squish($cookie);
    };

    return App::RecordStream::Aggregator::InjectInto::Subrefs->new($initial_sub, $combine_sub, $squish_sub);
}

App::RecordStream::DomainLanguage::Registry::register_fn(\&_subset_agg, 'subset_aggregator', 'SNIPPET', 'AGGREGATOR');
App::RecordStream::DomainLanguage::Registry::register_fn(\&_subset_agg, 'subset_agg', 'SNIPPET', 'AGGREGATOR');

1;
