# vim: set sw=3:

# This class handles the execution of "perl" code from the commandline on a
# record.  Handles magic of variable hiding and also special syntax issues.

package App::RecordStream::Executor;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Operation;

use Getopt::Long;

sub new {
  my $class         = shift;
  my $code          = shift;
  my $output_record = shift;


  my $this = {
     OUTPUT_RECORD => $output_record,
  };

  bless $this, $class;

  $this->init($code);

  return $this;
}

sub init {
   my $this = shift;
   my $code = shift;

   my $return_statement = '';
   if ( $this->{'OUTPUT_RECORD'} ) {
      $return_statement = '; $r;'
   }

   $this->{'CODE'} = create_code_ref($this->transform_code($code) . $return_statement);
   if ( $@ ) {
      die "Could not compile code '$code':\n$@"
   }
}

sub create_code_ref {
   my $__MY__code = shift;

   return eval <<CODE;
no strict;
no warnings;
package __MY__SafeCompartment;

my \$line = 0;
my \$r;

sub __MY__get_record {
   return \$r;
}

sub __MY__set_record {
   (\$r) = (\@_);
}

sub __MY__run_record { 
  my (\$filename) = \@_;
  \$line++;

  $__MY__code;
}

[\\\&__MY__get_record, \\\&__MY__set_record, \\\&__MY__run_record];
CODE
}

sub execute_code  {
   my ($get, $set, $run) = @{$_[0]->{'CODE'}};
   $set->($_[1]);
   return $run->(App::RecordStream::Operation::get_current_filename());
}

sub get_last_record {
   return $_[0]->{'CODE'}->[0]->();
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
   __FORMAT_TEXT__
    Recs code snippets are perl code, with one exception.  There a couple of
    variables predefined for you, and one piece of special syntax to assist in
    modifying hashes.
   __FORMAT_TEXT__

Special Variables:
   __FORMAT_TEXT__
    \$r    - the current record object.  This may be used exactly like a hash,
    or you can use some of the special record functions, see App::RecordStream::Record for
    more information

    \$line - This is the number of records run through the code snippet,
    starting at 1.  For most scripts this corresponds to the line number of the
    input to the script.

    \$filename - The filename of the originating record.  Note: This is only
    useful if you're passing filenames directly to the recs script, piping from
    other recs scripts or from cat, for instance, will not have a useful
    filename.
   __FORMAT_TEXT__

Special Syntax
   __FORMAT_TEXT__
    Use {{search_string}} to look for a string in the keys of a record, use /
    to nest keys.  You can nest into arrays by using an index.  If you are
    vivifying arrays (if the array doesn't exist, prefix your key with # so
    that an array rather than a hash will be created to put a / in your key,
    escape it twice, i.e. \\/

    This is exactly the same as a key spec that is always prefaced with a @,
    see 'man recs' for more info on key specs
   __FORMAT_TEXT__

    For example: A record that looks like:
    { "foo" : { "bar 1" : 1 }, "zoo" : 2}
    Could be accessed like this:

    # value of zoo  # value of \$r->{foo}->{bar 1}: (comma separate nested keys)
    {{zoo}}         {{foo/ar 1}}

    # Even assign to values (set the foo key to the value 1)
    {{foo}} = 1

   # And auto, vivify
    {{new_key/array_key/#0}} = 3 # creates an array within a hash within a hash

    # Index into an array
    {{array_key/#3}} # The value of index 3 of the array ref under the
                       'array_key' hash key.

   __FORMAT_TEXT__
    This matching is a fuzzy keyspec matching, see --help-keyspecs for more
    details.
   __FORMAT_TEXT__
USAGE
}

sub options_help {
   return (
      ['e', 'a perl snippet to execute, optional'],
      ['E', 'the name of a file to read as a perl snippet'],
   );
}

1;
