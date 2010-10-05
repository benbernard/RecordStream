# vim: set sw=3:

# This class handles the execution of "perl" code from the commandline on a
# record.  Handles magic of variable hiding and also special syntax issues.

package Recs::Executor;

use strict;
use warnings;

use Recs::Operation;

use Getopt::Long;

sub new {
  my $class = shift;
  my $code = shift;

  my $this = {};

  bless $this, $class;

  $this->{'CODE'} = create_code_ref($this->transform_code($code));
  if ( $@ ) {
     die "Could not compile code '$code':\n$@"
  }

  return $this;
}

sub create_code_ref {
   my $__MY__code = shift;

   return eval <<CODE;
no strict;
no warnings;
package __MY__SafeCompartment;

sub { 
  my (\$r, \$line, \$filename) = \@_;
  $__MY__code;
}
CODE
}

sub increment_line {
   my $this = shift;
   $this->{'LINE_COUNT'}++;
}

sub line_count {
   my $this = shift;
   return $this->{'LINE_COUNT'};
}

sub execute_code  {
   my $this   = shift;
   my $record = shift;

   $this->increment_line();
   $this->reset_error();

   my $line = $this->line_count();

   my $value = eval { $this->{'CODE'}->($record, $line, Recs::Operation::get_current_filename()); };

   if(my $error = $@) {
      undef $@;
      $this->set_error($error);
      chomp $error;
      warn "Code threw: " . $error . "\n";
   }
   else {
      return $value;
   }
}

sub last_error {
   my $this = shift;
   return $this->{'LAST_ERROR'};
}

sub set_error {
   my $this = shift;
   $this->{'LAST_ERROR'} = shift;
}

sub reset_error {
   my $this = shift;
   $this->{'LAST_ERROR'} = '';
}

sub transform_code {
   my $this = shift;
   my $code = shift;

   while ( $code =~ m/{{(.*?)}}/ ) {
      my $specifier = $1;
      my $guessing_code = '${$r->guess_key_from_spec(qq{\@' . $specifier . '})}';
      $code =~ s/{{.*?}}/$guessing_code/;
   }

   return $code;
}

sub usage {
   return <<USAGE;
CODE SNIPPETS:
    Recs code snippets are perl code, with one exception.  There a couple of
    variables predefined for you, and one piece of special syntax to assist in
    modifying hashes.

    \$r    - the current record object.  This may be used exactly like a hash,
    or you can use some of the special record functions, see Recs::Record for
    more information

    \$line - This is the number of records run through the code snippet,
    starting at 1.  For most scripts this corresponds to the line number of the
    input to the script.

    \$filename - The filename of the originating record.  Note: This is only
    useful if you're passing filenames directly to the recs script, piping from
    other recs scripts or from cat, for instance, will not have a useful
    filename.

    Use {{search_string}} to look for a string in the keys of a record, use /
    to nest keys.  You can nest into arrays by using an index.  If you are
    vivifying arrays (if the array doesn't exist, prefix your key with # so
    that an array rather than a hash will be created to put a / in your key,
    escape it twice, i.e. \\/

    This is exactly the same as a key spec that is always prefaced with a @,
    see 'man recs' for more info on key specs

    For example: A record that looks like:
    { "foo" : { "bar 1" : 1 }, "zoo" : 2}
    Could be accessed like this:

    # value of zoo  # value of \$r->{foo}->{bar 1}: (comma separate nested keys)
    {{zoo}}         {{foo/ar 1}}

    # Even assign to values (set the foo key to the value 1)
    {{fo}} = 1

    # And auto, vivify
    {{new_key/array_key/#0}} = 3 # creates an array within a hash within a hash

    # Index into an array
    {{array_key/#3}} # The value of index 3 of the array ref under the
                       'array_key' hash key.

    This matching is a fuzzy keyspec matching, see --help-keyspecs for more
    details.
USAGE
}

1;
