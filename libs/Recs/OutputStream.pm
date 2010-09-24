package Recs::OutputStream;

=head1 NAME

Recs::OutputStream

=head1 AUTHOR

Benjamin Bernard <perlhacker@benjaminbernard.com>
Keith Amling <keith.amling@gmail.com>

=head1 DESCRIPTION

An output stream for Recs::Record objects

=head1 SYNOPSIS

    use Recs::OutputStream;

    my $out    = Recs::OutputStream->new();

    my $record = Recs::Record->new("name" => "John Smith", "age" => 39);
    $out->put_record($record);

    my $hash = { foo => 'bar' };
    $out->put_hashref($hashref);


=head1 CONSTRUCTOR

=over 4

=item my $out = Recs::OutputStream->new(FH);

Takes an optional output file handle to print records to.  If none is
specified, will output to STDOUT

=back

=head1 PUBLIC METHODS

=over 4

=item $out->put_record(RECORD);

Takes a L<Recs::Record> object and puts it on the output file handle.

=item $out->put_hashref(HASH_REF);

Puts the HASH_REF on the output stream as a record.

=item $out->record_string(RECORD);

String representation of a record, what would be printed from put_record

=item $out->put_hashref(HASH_REF);

String representation of a hash ref, what would be printed from put_hashref

=back

=cut

use strict;
use lib;

use JSON::Syck;

our $AUTOLOAD;

sub new
{
   my $class = shift;
   my ($fh) = @_;

   $fh ||= \*STDOUT;

   my $this =
   {
      'fh' => $fh,
   };

   bless $this, $class;

   return $this;
}

sub put_record
{
   my ($this, $rec) = @_;

   my $fh = $this->{'fh'};
   print $fh JSON::Syck::Dump($rec->as_hashref()) . "\n";
}

sub put_hashref
{
   my ($this, $hr) = @_;

   my $fh = $this->{'fh'};
   print $fh JSON::Syck::Dump($hr) . "\n";
}

sub record_string {
  my ($this, $rec) = @_;
  return JSON::Syck::Dump($rec->as_hashref());
}

sub hashref_string {
  my ($this, $hr) = @_;
  return JSON::Syck::Dump($hr);
}

1;
