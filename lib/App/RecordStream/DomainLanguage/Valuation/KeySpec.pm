package App::RecordStream::DomainLanguage::Valuation::KeySpec;

use strict;
use warnings;

use App::RecordStream::DomainLanguage::Valuation;

use base ('App::RecordStream::DomainLanguage::Valuation');

sub new
{
    my $class = shift;
    my $keyspec = shift;

    my $this =
    {
        'KEYSPEC' => $keyspec,
    };

    bless $this, $class;

    return $this;
}

sub evaluate_record
{
    my $this = shift;
    my $r = shift;

    my $keyspec = $this->{'KEYSPEC'};

    return ${$r->guess_key_from_spec($keyspec)};
}

1;
