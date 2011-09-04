package App::RecordStream::DomainLanguage::Library;

use strict;
use warnings;

use App::RecordStream::DomainLanguage::Registry;
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

1;
