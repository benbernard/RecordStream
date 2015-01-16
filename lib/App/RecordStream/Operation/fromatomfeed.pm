package App::RecordStream::Operation::fromatomfeed;

our $VERSION = "4.0.11";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Record;

use App::RecordStream::OptionalRequire 'LWP::UserAgent';
use App::RecordStream::OptionalRequire 'XML::Twig';
BEGIN { App::RecordStream::OptionalRequire::require_done() }

sub init
{
  my $this = shift;
  my $args = shift;

  my $follow = 1;
  my $max    = undef;

  my %options =
  (
    "follow!" => \$follow,
    'max=s'   => \$max,
  );

  $this->parse_options($args, \%options);

  $this->{'COUNT'}  = 0;
  $this->{'FOLLOW'} = $follow;
  $this->{'MAX'}    = $max;
  $this->{'URLS'}   = $args;
}

sub wants_input
{
  return 0;
}

sub stream_done
{
  my ($this) = @_;

  my $ua = $this->make_user_agent();

  my $request = HTTP::Request->new();
  $request->method('GET');

  my $twig_roots = { '/*/entry' => sub { $this->handle_entry_elem( @_ ) } };

  if ( $this->{'FOLLOW'} ) {
    $twig_roots->{ '/*/link[ @rel="next" and @href ]' } = sub { $this->handle_link_elem( @_ ) };
  }

  my $twig = XML::Twig->new(twig_roots => $twig_roots);

  while (my $url = shift @{ $this->{'URLS'} })
  {
    $this->update_current_filename($url);
    $request->uri($url);
    my $response = $ua->request($request);

    if (!$response->is_success)
    {
      warn "# $0 GET $url failed: " . $response->message;
      $this->_set_exit_value(1);
      next;
    }

    $twig->parse( $response->content );
  }
}

sub handle_entry_elem {
  my ($this, $twig, $entry_elem) = @_;

  $this->{'COUNT'}++;

  my $record = App::RecordStream::Record->new( $entry_elem->simplify );
  $this->push_record($record);

  if (defined $this->{'MAX'} && $this->{'COUNT'} >= $this->{'MAX'}) {
    $this->{'URLS'} = [];
    $twig->finish_now;
  }

  $twig->purge;
}

# Follow the feed 'next' link if present. It is a proposed part
# of the standard - see http://www.ietf.org/rfc/rfc5005.txt
sub handle_link_elem {
  my ($this, $twig, $link_elem) = @_;

  unshift @{ $this->{'URLS'} }, $link_elem->att('href');
  $twig->purge;
}

sub make_user_agent {
  return LWP::UserAgent->new();
}

sub usage
{
  my $this = shift;

  my $options = [
    [ '[no]follow', 'Follow atom feed next links (or not).  Defaults on.'],
    [ 'max=<n>', 'Print at most <n> entries and then exit.'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-fromatomfeed <args> [<uris>]
   __FORMAT_TEXT__
   Produce records from atom feed entries.

   Recs from atom feed will get entries from paginated atom feeds and create
   a record stream from the results. The keys of the record will be the fields
   in the atom field entry. Recs from atom feed will follow the 'next' link in
   a feed to retrieve all entries.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Dump an entire feed
      recs-fromatomfeed "http://my.xml.com"
   Dumps just the first page of entries
      recs-fromatomfeed --nofollow "http://my.xml.com"
   Dumps just the first 10 entries
      recs-fromatomfeed --max 10 "http://my.xml.com"
USAGE
}

1;
