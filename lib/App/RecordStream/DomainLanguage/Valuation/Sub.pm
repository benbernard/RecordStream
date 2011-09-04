package App::RecordStream::DomainLanguage::Valuation::Sub;

use strict;
use warnings;

use App::RecordStream::DomainLanguage::Valuation;

use base ('App::RecordStream::DomainLanguage::Valuation');

sub new
{
    my $class = shift;
    my $subref = shift;

    my $this =
    {
        'SUBREF' => $subref,
    };

    bless $this, $class;

    return $this;
}

sub evaluate_record
{
    my $this = shift;
    my $r = shift;

    my $subref = $this->{'SUBREF'};

    return $subref->($r);
}

1;
