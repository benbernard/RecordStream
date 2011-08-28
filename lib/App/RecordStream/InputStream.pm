package App::RecordStream::InputStream;

=head1 NAME

App::RecordStream::InputStream

=head1 AUTHOR

Benjamin Bernard <perlhacker@benjaminbernard.com>
Keith Amling <keith.amling@gmail.com>

=head1 DESCRIPTION

This module will generate an stream of App::RecordStream::Record objects for given inputs.

=head1 SYNOPSIS

  use App::RecordStream::InputStream;
  my $stream = App::RecordStream::InputStream(STRING => $recs_string);

  while ( my $record = $stream->get_record() ) {
    ... do stuff ...
  }

=head1 CONSTRUCTOR

=over 4

=item my $in = App::RecordStream::InputStream->new(OPTIONS);

The input stream takes named paramters, it will take one of: FILE, STRING, or FH
(a file handle).

  FILE   - Name of a file, must be readable
  STRING - String of new line separated records
  FH     - File handle to a stream of data

Optionally, it wil take a NEXT argument.  The NEXT argument should be another
InputStream object.  Once the returned object reaches the end of its string, it
will get records from the NEXT App::RecordStream::InputStream.  In this manner, InputStream
objects can be chained

returns an instance of InputStream

=item my $in = App::RecordStream::InputStream->new_magic()

Provides GNU-style input semantics for scripts.  If there are arguments left in
@ARGV, it will assume those are file names and make a set of chained streams
for those files, returning the first stream.  If no files are specified, will
open an InputStream on STDIN

=item my $in = App::RecordStream::InpustStream->new_from_files(FILES)

Takes an array of FILES and constructs a set of chained streams for those
files.  Returns the first stream

=back


=head1 PUBLIC METHODS

=over 4

=item my $record = $this->get_record();

Retrieve the next L<App::RecordStream::Record> from the stream.  Will return a false value
if no records are available.  If this stream has a NEXT stream specified in the
constructor, this will continue to return Record objects until all chained
streams are exhausted

=back

=cut

our $VERSION = "3.4";

use strict;
use lib;

use IO::String;
use JSON qw(decode_json);

use App::RecordStream::Record;
require App::RecordStream::Operation;

my $ONE_OF = [qw(FH STRING FILE)];

my $ARGUMENTS = {
   FH     => 0,
   STRING => 0,
   FILE   => 0,
   NEXT   => 0,
};

sub new_magic {
   my $class = shift;
   my $files = shift || \@ARGV;

   if ( scalar @$files > 0 ) {
      return $class->new_from_files($files);
   }

   return $class->new(FH => \*STDIN);
}

sub new_from_files {
   my $class = shift;
   my $files = shift;

   my $last_stream;

   foreach my $file ( reverse @$files )  {
      unless ( -e $file && -r $file ) {
         die "File does not exist or is not readable: $file\n";
      }

      my $new_stream = $class->new(FILE => $file, NEXT => $last_stream);
      $last_stream   = $new_stream;
   }

   return $last_stream;
}

sub new {
   my $class = shift;
   my %args  = @_;

   my $this = {};

   foreach my $key (keys %$ARGUMENTS) {
      my $value = $args{$key};
      $this->{$key} = $value;

      if ( $ARGUMENTS->{$key} ) {
         die "Did not supply required argument: $key" unless ( $value );
      }
   }

   bless $this, $class;

   $this->_init();
   return $this;
}

sub _init {
   my $this = shift;

   my $found = {};

   foreach my $arg (@$ONE_OF) {
      if ( $this->{$arg} ) {
         $found->{$arg} = $this->{$arg};
      }
   }

   if ( scalar keys %$found > 1 ) {
      die "Must specify only one of " . join(' ', keys %$found);
   }

   unless ( scalar keys %$found == 1 ) {
      die "Must specify one of " . join(' ', @$ONE_OF);
   }

   if ( $this->get_string() ) {
      $this->{'FH'} = IO::String->new($this->get_string());
   }

   my $file = $this->get_file();
   if ( $file ) {
      open(my $fh, '<', $file) or die "Cannot open $file: $!";
      $this->{'FH'} = $fh;
   }
}

sub get_file {
   my $this = shift;
   return $this->{'FILE'};
}

sub get_string {
   my $this = shift;
   return $this->{'STRING'};
}

# Performance! :(
sub get_fh {
   return $_[0]->{'FH'};
}

sub get_record {
   my $this = shift;

   if ( $this->is_done() ) {
      return $this->call_next_record();
   }

   my $fh   = $this->get_fh();

   my $line   = <$fh>;

   if ( ! $line ) {
      close $fh;
      $this->set_done();

      # This is ugly, reaching into the other class
      App::RecordStream::Operation::set_current_filename($this->get_filename());

      return $this->call_next_record();
   }

   # Direct bless done in the name of performance
   my $record = decode_json($line);
   bless $record, 'App::RecordStream::Record';

   return $record;
}

sub call_next_record {
   my $this = shift;

   my $next = $this->get_next();

   unless ( $next ) {
      return undef;
   }

   # Prevent a deep recursion with many passed files
   if ( $next && $next->is_done() ) {
     $next = $next->get_next();
     $this->{'NEXT'} = $next;
   }

   return $next->get_record();
}

sub get_filename {
  my $this = shift;

  if ( ! $this->is_done() ) {
    return $this->get_file() if ( $this->get_file() );
    return 'STRING_INPUT' if ( $this->get_string() );
    return 'STREAM_INPUT' if ( $this->get_fh() );
    return 'UNKNOWN';
  }
  elsif ( $this->get_next() ) {
      return $this->get_next()->get_filename();
  }

}

sub get_next {
   my $this = shift;
   return $this->{'NEXT'};
}

sub is_done {
  return $_[0]->{'DONE'};
}

sub set_done {
   my $this = shift;
   $this->{'DONE'} = 1;
}

1;
