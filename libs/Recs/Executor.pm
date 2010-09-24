# vim: set sw=3:

# This class handles the execution of "perl" code from the commandline on a
# record.  Handles magic of variable hiding and also special syntax issues.

package Recs::Executor;

use strict;
use warnings;

use Getopt::Long;

sub new {
  my $class = shift;
  my $code = shift;
  
  my $this = {};

  bless $this, $class;

  $this->{'CODE'} = $this->transform_code($code);
  return $this;
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
   my $__MY__this   = shift;
   my $__MY__record = shift;

   $__MY__this->increment_line();
   $__MY__this->reset_error();
   
   my $__MY__value;

   {
      no strict;
      no warnings;

      my $r = $__MY__record;
      my $line = $__MY__this->line_count();

      $__MY__value = eval $__MY__this->{'CODE'};
   }

   if(my $error = $@)
   {
      undef $@;
      $__MY__this->set_error($error);
      chomp $error;
      warn "Code threw: " . $error . "\n";
   }
   else
   {
      return $__MY__value;
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
Code Snippets:
    Recs code snippets are perl code, with one exception.  There a couple of
    variables predefined for you, and one piece of special syntax to assist in
    modifying hashes.
    
    \$r    - the current record object.  This may be used exactly like a hash, or you
    can use some of the special record functions, see Recs::Record for more
    information
    
    \$line - This is the number of records run through the code snippet, starting
    at 1.  For most scripts this corresponds to the line number of the input to the
    script.
    
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
    {{array_key/#3}} # The value of index 3 of the array ref under the 'array_key' hash key.
    
    Matching works like this in order, first key to match wins
    1. Exact match ( eq )
    2. Prefix match ( m/^/ )
    3. Match anywehre in the key (m//)
USAGE
}

1;
