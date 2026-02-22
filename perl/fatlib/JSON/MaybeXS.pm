package JSON::MaybeXS;

use strict;
use warnings FATAL => 'all';
use base qw(Exporter);

our $VERSION = '1.002005';

sub _choose_json_module {
    return 'Cpanel::JSON::XS' if $INC{'Cpanel/JSON/XS.pm'};
    return 'JSON::XS'         if $INC{'JSON/XS.pm'};

    my @err;

    return 'Cpanel::JSON::XS' if eval { require Cpanel::JSON::XS; 1; };
    push @err, "Error loading Cpanel::JSON::XS: $@";

    return 'JSON::XS' if eval { require JSON::XS; 1; };
    push @err, "Error loading JSON::XS: $@";

    return 'JSON::PP' if eval { require JSON::PP; 1 };
    push @err, "Error loading JSON::PP: $@";

    die join( "\n", "Couldn't load a JSON module:", @err );

}

BEGIN {
    our $JSON_Class = _choose_json_module();
    $JSON_Class->import(qw(encode_json decode_json));
}

our @EXPORT = qw(encode_json decode_json JSON);
our @EXPORT_OK = qw(is_bool);
our %EXPORT_TAGS = ( all => [ @EXPORT, @EXPORT_OK ] );

sub JSON () { our $JSON_Class }

sub new {
  shift;
  my %args = @_ == 1 ? %{$_[0]} : @_;
  my $new = (our $JSON_Class)->new;
  $new->$_($args{$_}) for keys %args;
  return $new;
}

use Scalar::Util ();

sub is_bool {
  die 'is_bool is not a method' if $_[1];

  Scalar::Util::blessed($_[0])
    and ($_[0]->isa('JSON::XS::Boolean')
      or $_[0]->isa('JSON::PP::Boolean'));
}

1;

=head1 NAME

JSON::MaybeXS - Use L<Cpanel::JSON::XS> with a fallback to L<JSON::XS> and L<JSON::PP>

=head1 SYNOPSIS

  use JSON::MaybeXS;

  my $data_structure = decode_json($json_input);

  my $json_output = encode_json($data_structure);

  my $json = JSON->new;

  my $json_with_args = JSON::MaybeXS->new(utf8 => 1); # or { utf8 => 1 }

=head1 DESCRIPTION

This module first checks to see if either L<Cpanel::JSON::XS> or
L<JSON::XS> is already loaded, in which case it uses that module. Otherwise
it tries to load L<Cpanel::JSON::XS>, then L<JSON::XS>, then L<JSON::PP>
in order, and either uses the first module it finds or throws an error.

It then exports the C<encode_json> and C<decode_json> functions from the
loaded module, along with a C<JSON> constant that returns the class name
for calling C<new> on.

If you're writing fresh code rather than replacing L<JSON.pm|JSON> usage, you might
want to pass options as constructor args rather than calling mutators, so
we provide our own C<new> method that supports that.

=head1 EXPORTS

C<encode_json>, C<decode_json> and C<JSON> are exported by default; C<is_bool>
is exported on request.

To import only some symbols, specify them on the C<use> line:

  use JSON::MaybeXS qw(encode_json decode_json is_bool); # functions only

  use JSON::MaybeXS qw(JSON); # JSON constant only

To import all available symbols, use C<:all>:

  use JSON::MaybeXS ':all';

=head2 encode_json

This is the C<encode_json> function provided by the selected implementation
module, and takes a perl data structure which is serialised to JSON text.

  my $json_text = encode_json($data_structure);

=head2 decode_json

This is the C<decode_json> function provided by the selected implementation
module, and takes a string of JSON text to deserialise to a perl data structure.

  my $data_structure = decode_json($json_text);

=head2 JSON

The C<JSON> constant returns the selected implementation module's name for
use as a class name - so:

  my $json_obj = JSON->new; # returns a Cpanel::JSON::XS or JSON::PP object

and that object can then be used normally:

  my $data_structure = $json_obj->decode($json_text); # etc.

=head2 is_bool

  $is_boolean = is_bool($scalar)

Returns true if the passed scalar represents either C<true> or
C<false>, two constants that act like C<1> and C<0>, respectively
and are used to represent JSON C<true> and C<false> values in Perl.

Since this is a bare sub in the various backend classes, it cannot be called as
a class method like the other interfaces; it must be called as a function, with
no invocant.  It supports the representation used in all JSON backends.

=head1 CONSTRUCTOR

=head2 new

With L<JSON::PP>, L<JSON::XS> and L<Cpanel::JSON::XS> you are required to call
mutators to set options, such as:

  my $json = $class->new->utf8(1)->pretty(1);

Since this is a trifle irritating and noticeably un-perlish, we also offer:

  my $json = JSON::MaybeXS->new(utf8 => 1, pretty => 1);

which works equivalently to the above (and in the usual tradition will accept
a hashref instead of a hash, should you so desire).

=head1 BOOLEANS

To include JSON-aware booleans (C<true>, C<false>) in your data, just do:

    use JSON::MaybeXS;
    my $true = JSON->true;
    my $false = JSON->false;

=head1 AUTHOR

mst - Matt S. Trout (cpan:MSTROUT) <mst@shadowcat.co.uk>

=head1 CONTRIBUTORS

=over 4

=item * Clinton Gormley <drtech@cpan.org>

=item * Karen Etheridge <ether@cpan.org>

=back

=head1 COPYRIGHT

Copyright (c) 2013 the C<JSON::MaybeXS> L</AUTHOR> and L</CONTRIBUTORS>
as listed above.

=head1 LICENSE

This library is free software and may be distributed under the same terms
as perl itself.

=cut
