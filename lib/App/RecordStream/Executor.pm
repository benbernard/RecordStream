# This class handles the execution of "perl" code from the commandline on a
# record.  Handles magic of variable hiding and also special syntax issues.

package App::RecordStream::Executor;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Operation;

my $NEXT_ID = 0;
my $DEFAULT_METHOD_NAME = '__MY__DEFAULT';

# snippets is of the form:
# name => {
#   arg_names => ['a', 'b'],
#
#   # one of these:
#   code => 'code string',
# }
#
sub new {
  my $class         = shift;
  my $snippets      = shift;

  if ( ref($snippets) ne 'HASH' ) {
    my $code = <<CODE;
      \$filename = App::RecordStream::Operation::get_current_filename();
      \$line++;
      $snippets;
CODE

    $snippets = {
      $DEFAULT_METHOD_NAME => {
        code => $code,
        arg_names => ['r'],
      },
    };
  }

  my $this = {
    ID            => $NEXT_ID,
    SNIPPETS      => $snippets,
  };

  $NEXT_ID++;

  bless $this, $class;

  $this->init();

  return $this;
}

sub init {
  my $this  = shift;
  $this->create_safe_package();
}

sub create_snippets {
  my $this = shift;

  my $code = '';

  foreach my $name (keys %{$this->{'SNIPPETS'}} ) {
    my $arg_names = $this->{'SNIPPETS'}->{$name}->{'arg_names'};
    my $args_spec = '';

    if ( $arg_names ) {
      $args_spec = 'my (';
      $args_spec .= join(',', map { "\$$_"} @$arg_names);
      $args_spec .= ') = @_;';
    }

    my $method_name = $this->get_method_name($name);
    my $snippet = $this->transform_code($this->{'SNIPPETS'}->{$name}->{'code'});

    $code .= <<CODE;
sub $method_name {
   $args_spec

   $snippet
}
CODE
  }

  return $code;
}

sub get_method_name {
  my $this = shift;
  my $name = shift;

  return '__MY__' . $name;
}

sub get_safe_package_name {
  my $this = shift;
  return '__MY__SafeCompartment_' . $this->{'ID'};
}

sub create_safe_package {
  my $this = shift;
  my $package_name = $this->get_safe_package_name();
  my $snippets = $this->create_snippets();

  my $code = <<CODE;
package $package_name;

$snippets

1;
CODE

  eval_safe_package($code);
  if ( $@ ) {
    die $@;
  }

  foreach my $name (keys %{$this->{'SNIPPETS'}}) {
    my $method_name = $this->get_method_name($name);
    my $code_ref = \&{$package_name . '::' . $method_name};
    $this->{'SNIPPETS'}->{$name}->{'CODE_REF'} = $code_ref;
  }
}

 sub clear_vars {
   my $this = shift;

   my $package_name = $this->get_safe_package_name();

   my %method_names = map { $this->get_method_name($_) => 1 } keys %{$this->{'SNIPPETS'}};

   {
     no strict;
     no warnings;

     foreach my $variable (keys %{$package_name . '::'}) {
       next if ( exists $method_names{$variable} );
       delete %{$package_name . '::'}->{$variable};
     }
   }
 }

 sub set_scalar {
   my $this = shift;
   my $name = shift;
   my $val = shift;

   my $package_name = $this->get_safe_package_name();

   {
     no strict;
     no warnings;

     *{$package_name . '::' . $name} = \$val;
   }
 }

 sub get_scalar {
   my $this = shift;
   my $name = shift;

   my $package_name = $this->get_safe_package_name();

   {
     no strict;
     no warnings;

     return ${$package_name . '::' . $name};
   }
 }

 sub set_executor_method {
   my $this = shift;
   my $name = shift;
   my $ref = shift;

   my $package_name = $this->get_safe_package_name();

   {
     no strict;
     no warnings;

     *{$package_name . "::" . $name} = $ref;
   }
 }

 sub get_code_ref {
   my $this = shift;
   my $name = shift;
   $this->{'SNIPPETS'}->{$name}->{'CODE_REF'};
 }

 sub eval_safe_package {
   my $__MY__code = shift;

   my $code =  <<CODE;
no strict;
no warnings;

$__MY__code
CODE

  eval $code;
  if ($@) {
    die $@;
  }
}

sub execute_code {
  my ($this, @args) = @_;
  return $this->execute_method($DEFAULT_METHOD_NAME, @args);
}

sub execute_method {
  my ($this, $name, @args) = @_;
  return $this->get_code_ref($name)->(@args);
}

sub transform_code {
  my $this = shift;
  my $code = shift;

  while ( $code =~ m/{{(.*?)}}/ ) {
    my $specifier = $1;
    my $guessing_code = '${App::RecordStream::KeySpec::find_key($r, qq{\@' . $specifier . '})}';
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
    ['M module[=...]', 'execute "use module..." before executing snippet; same behaviour as perl -M'],
    ['m module[=...]', 'same as -M, but by default import nothing'],
  );
}

1;
