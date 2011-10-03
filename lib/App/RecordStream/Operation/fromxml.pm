package App::RecordStream::Operation::fromxml;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use XML::Simple;
use App::RecordStream::Record;
use LWP::UserAgent;
use HTTP::Request;

sub init {
   my $this = shift;
   my $args = shift;

   my @elements;
   my $nested = 0;

   my $spec = {
      'element=s' => sub { push @elements, split(/,/, $_[1]) },
      'nested'    => \$nested,
   };

   $this->parse_options($args, $spec);

   $this->{'ELEMENTS'} = { map { $_ => 1 } @elements };
   $this->{'NESTED'}   = $nested;

   my $has_files = scalar @$args;
   $this->{'HAS_URIS'} = $has_files;

   $this->{'EXTRA_ARGS'} = $args;
}

sub wants_input {
   return 0;
}

sub stream_done {
   my $this = shift;

   my $elements = $this->{'ELEMENTS'};
   while ( my $xml = $this->get_xml_string() ) {
      my $xml_hash = XMLin(
         $xml,
         ForceArray => $elements,
         KeyAttr    => [],
      );

      if ( $this->{'NESTED'} ) {
         $this->find_elements($elements, $xml_hash);
      }
      else {
         foreach my $element ( keys %$elements ) {
            if ( exists $xml_hash->{$element} ) {
               $this->push_value($xml_hash->{$element}, {});
            }
         }
      }
   }
}

sub find_elements {
   my $this     = shift;
   my $elements = shift;
   my $value    = shift;

   if ( UNIVERSAL::isa($value, 'HASH') ) {
      foreach my $key (keys %$value) {
         if ( $elements->{$key} ) {
            $this->push_value($value->{$key}, {element => $key});
         }
         else {
            $this->find_elements($elements, $value->{$key});
         }
      }
   }
   elsif ( UNIVERSAL::isa($value, 'ARRAY') ) {
      foreach my $item (@$value) {
         $this->find_elements($elements, $item);
      }
   }
}

sub push_value {
   my $this         = shift;
   my $value        = shift;
   my $default_hash = shift;

   if ( UNIVERSAL::isa($value, 'HASH') ) {
      my $record = App::RecordStream::Record->new($value);
      foreach my $key ( keys %$default_hash ) {
         $record->{$key} = $default_hash->{$key};
      }

      $this->push_record($record);
   }
   elsif ( UNIVERSAL::isa($value, 'ARRAY') ) {
      foreach my $item (@$value) {
         $this->push_value($item, $default_hash);
      }
   }
   else {
      my $record = App::RecordStream::Record->new(%$default_hash);
      $record->{'value'} = $value;
      $this->push_record($record);
   }
}

sub get_xml_string {
   my $this = shift;

   my $uris = $this->{'EXTRA_ARGS'};

   my $contents;
   if ( $this->{'HAS_URIS'} ) {
      return undef unless ( @$uris );

      my $uri = shift @$uris;
      $this->update_current_filename($uri);

      my $ua = $this->make_user_agent();
      my $response = $ua->request($this->get_request($uri));

      if ( ! $response->is_success() ) {
         warn "GET uri: '$uri' failed, skipping!\n";
         return $this->get_xml_string();
      }

      $contents = $response->content();
   }
   else {
      local $/;
      $contents = <STDIN>;
   }

   return $contents;
}

sub get_request {
   my $this = shift;
   my $uri  = shift;

   my $request = HTTP::Request->new();
   $request->method('GET');
   $request->uri($uri);

   return $request;
}

sub make_user_agent {
    return LWP::UserAgent->new();
}

sub usage {
   my $this = shift;

   my $options = [
      [ 'elements <elements>', 'May be comma separated, may be specified multiple times.  Sets the elements to print records for'],
      [ 'nested', 'search for elements at all levels of the xml document'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-fromxml <args> [<URIs>]
   __FORMAT_TEXT__
   Reads either from STDIN or from the specified URIs.  Parses the xml
   documents, and creates records for the specified elements
   __FORMAT_TEXT__

$args_string

Examples:
   Create records for the bar element at the top level of myXMLDoc
      recs-fromxml --element bar file:myXMLDoc
   Create records for all foo and bar elements from the URL
      recs-fromxml --element foo,bar --nested http://google.com
USAGE
}

1;
