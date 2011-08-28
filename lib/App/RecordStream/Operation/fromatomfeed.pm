package Recs::Operation::fromatomfeed;

use strict;
use warnings;

use base qw(Recs::Operation);

use Data::Dumper;
use Getopt::Long;
use LWP::UserAgent;
use XML::Simple;

use Recs::Record;

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

   $this->{'FOLLOW'} = $follow;
   $this->{'MAX'}    = $max;
   $this->{'URLS'}   = $this->_get_extra_args();
}

sub run_operation
{
   my ($this) = @_;

   my $ua = $this->make_user_agent();

   my $request = HTTP::Request->new();
   $request->method('GET');

   my @urls = @{$this->{'URLS'}};

   my $count = 0;
URL:
   while (my $url = shift @urls)
   {
      $request->uri($url);
      my $response = $ua->request($request);

      if (!$response->is_success)
      {
         warn "# $0 GET $url failed: " . $response->message;
         $this->_set_exit_value(1);
         next;
      }

      my $xml = XMLin($response->content,
                      forcearray => [ 'entry', 'link' ],
                      keyattr => [ 'rel' ]);

      foreach my $entry (@{$xml->{entry}})
      {
         $count++;
         my $record = Recs::Record->new(%$entry);
         $this->push_record($record);
         if (defined $this->{'MAX'} && $count >= $this->{'MAX'})
         {
            last URL;
         }
      }

      # Follow the feed 'next' link if present. It is a proposed part
      # of the standard - see http://www.ietf.org/rfc/rfc5005.txt
      if ($this->{'FOLLOW'} && exists $xml->{link}->{next})
      {
         unshift @urls, $xml->{link}->{next}->{href};
      }
   }
}

sub make_user_agent {
    return LWP::UserAgent->new();
}

sub usage
{
   return <<USAGE;
Usage: recs-fromatomfeed <args> [<uris>]
   Produce records from atom feed entries.

   Recs from atom feed will get entries from paginated atom feeds and create
   a record stream from the results. The keys of the record will be the fields
   in the atom field entry. Recs from atom feed will follow the 'next' link in
   a feed to retrieve all entries.


Help / Usage Options:
   --[no]follow                   Follow atom feed next links (or not).  Defaults on.
   --max=<n>                      Print at most <n> entries and then exit.

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
