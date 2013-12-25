package App::RecordStream::Operation::fromxml;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Record;
use HTTP::Request;
use LWP::UserAgent;
use List::MoreUtils qw( uniq );
use XML::Twig;

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

  $this->{'ELEMENTS'} = [ uniq @elements ];
  $this->{'NESTED'}   = $nested;

  my $has_files = scalar @$args;
  $this->{'HAS_URIS'} = $has_files;

  $this->{'EXTRA_ARGS'} = $args;
  $this->{'OPEN_TAGS'}  = 0;
}

sub wants_input {
  return 0;
}

sub stream_done {
  my $this = shift;

  my $elements = $this->{'ELEMENTS'};

  my $elem_prefix = '/*/';
  my $attr_prefix = '/';

  if ( $this->{'NESTED'} ) {
    $elem_prefix .= '/';
    $attr_prefix .= '/';
  }

  my %start_tag_handlers;
  my %twig_roots;

  for my $element ( @$elements ) {
    my $elem_expr = $elem_prefix . $element;
    my $attr_expr = $attr_prefix . '[@' . $element . ']';
    my $default_hash = {};

    if ( @$elements > 1 ) {
      $default_hash->{'element'} = $element;
    }

    $start_tag_handlers{$elem_expr} = sub { $this->{'OPEN_TAGS'}++ };
    $twig_roots{$elem_expr} = sub { $this->handle_element($default_hash, @_) };
    $twig_roots{$attr_expr} = sub { $this->handle_attribute($element, $default_hash, @_) };
  }

  my $twig = XML::Twig->new(
    start_tag_handlers => \%start_tag_handlers,
    twig_roots         => \%twig_roots);

  while ( my $xml = $this->get_xml_string() ) {
    $twig->parse($xml);
  }
}

sub handle_element {
  my ($this, $default_hash, $twig, $elem) = @_;

  $this->{'OPEN_TAGS'}--; # force evaluation of outer elements before inner

  if ( $this->{'OPEN_TAGS'} == 0 ) {
    my $s = $elem->simplify('forcearray' => 1,
                            'keyattr'    => [] );

    $this->push_value($s, $default_hash);
    $twig->purge;
  }

  return 0; # don't trigger attr handler
}

sub handle_attribute {
  my ($this, $name, $default_hash, $twig, $elem) = @_;

  if ( $this->{'OPEN_TAGS'} == 0 ) {
    $this->push_value($elem->att($name), $default_hash);
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
    [ 'element <elements>', 'May be comma separated, may be specified multiple times.  Sets the elements/attributes to print records for'],
    [ 'nested', 'search for elements at all levels of the xml document'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-fromxml <args> [<URIs>]
   __FORMAT_TEXT__
   Reads either from STDIN or from the specified URIs.  Parses the xml
   documents, and creates records for the specified elements.
   If multiple element types are specified, will add a {'element' => element name} field to the output record.
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
