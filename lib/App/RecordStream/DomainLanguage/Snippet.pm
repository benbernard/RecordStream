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

  my $pos = 0;
  my $out = '';
  while(1)
  {
    my $top_level_entrance = index($code, '<<', $pos);
    if($top_level_entrance == -1)
    {
      $out .= substr($code, $pos);
      last;
    }

    my $level = 1;
    my $pos2 = $top_level_entrance + 2;
    my $top_level_exit;
    while(1)
    {
      my $next_enter = index($code, '<<', $pos2);
      my $next_exit = index($code, '>>', $pos2);

      if($next_enter != -1 && ($next_exit == -1 || $next_enter < $next_exit))
      {
        ++$level;
        $pos2 = $next_enter + 2;
        next;
      }

      if($next_exit != -1 && ($next_enter == -1 || $next_exit < $next_enter))
      {
        --$level;
        if($level == 0)
        {
          $top_level_exit = $next_exit;
          last;
        }
        $pos2 = $next_enter + 2;
        next;
      }

      die "Unbalanced << and >> in snippet: $code";
    }

    $out .= substr($code, $pos, $top_level_entrance - $pos);
    $out .= _quote_snippet(substr($code, $top_level_entrance + 2, $top_level_exit - $top_level_entrance - 2));
    $pos = $top_level_exit + 2;
  }

  return $out;
}

sub _quote_snippet
{
    my $code = shift;

    return "snip('$code')";
}

1;
