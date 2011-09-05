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
    $code = _transform_angles($code);

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

sub _transform_angles
{
    my $code = shift;

    my $in = $code;
    my $out = '';
    my $level = 0;
    my $state = 'ZERO';
    my $c = undef;
    my $redo = 0;
    my $had_eof = 0;

    while(1)
    {
        if(!$redo)
        {
            if(length($in))
            {
                $c = substr($in, 0, 1, "");
            }
            elsif($had_eof)
            {
                last;
            }
            else
            {
                $had_eof = 1;
                $c = '';
            }
        }
        $redo = 0;

        if($state eq 'ZERO')
        {
            if(0)
            {
            }
            elsif($c eq '<')
            {
                $state = 'ENTER';
            }
            elsif($c eq '>')
            {
                $state = 'EXIT';
            }
            else
            {
                $out .= $c;
            }
        }
        elsif($state eq 'ENTER')
        {
            if(0)
            {
            }
            elsif($c eq '<')
            {
                if($level == 0)
                {
                    $out .= "snip('";
                }
                else
                {
                    $out .= '<<';
                }
                ++$level;
                $state = 'ZERO';
            }
            else
            {
                $out .= '<';
                $redo = 1;
                $state = 'ZERO';
            }
        }
        elsif($state eq 'EXIT')
        {
            if(0)
            {
            }
            elsif($c eq '>')
            {
                --$level;
                if($level == 0)
                {
                    $out .= "')";
                }
                else
                {
                    $out .= '>>';
                }
                $state = 'ZERO';
            }
            else
            {
                $out .= '>';
                $redo = 1;
                $state = 'ZERO';
            }
        }
        else
        {
            die "Invalid state in snippet angle transform: $state";
        }
    }

    return $out;
}

1;
