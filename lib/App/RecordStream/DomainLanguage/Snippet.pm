package App::RecordStream::DomainLanguage::Snippet;

use strict;
use warnings;

use App::RecordStream::DomainLanguage::Executor;
use App::RecordStream::DomainLanguage::Value;
use App::RecordStream::Executor;

sub new
{
    my $class = shift;
    my $code = shift;

    $code = App::RecordStream::Executor->transform_code($code);

    my $this =
    {
        'CODE' => $code,
    };

    bless $this, $class;

    return $this;
}

sub evaluate_as
{
    my $this = shift;
    my $type = shift;
    my $vars = shift || {};

    my $executor = App::RecordStream::DomainLanguage::Executor->new();
    $executor->import_registry();

    for my $var (keys(%$vars))
    {
        if(0)
        {
        }
        elsif($var =~ /^\$(.*)$/)
        {
            $executor->set_scalar($1, $vars->{$var});
        }
        else
        {
            die "Bad var for snippet: '$var'";
        }
    }
    my $result = $executor->exec($this->{'CODE'});

    return App::RecordStream::DomainLanguage::Value::cast_or_die($type, $result);
}

1;
