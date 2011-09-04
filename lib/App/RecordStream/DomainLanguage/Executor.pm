package App::RecordStream::DomainLanguage::Executor;

use strict;
use warnings;

use App::RecordStream::DomainLanguage::Registry;
use App::RecordStream::Executor;

my $next_id = 0;

sub new
{
    my $class = shift;

    my $id = $next_id++;

    my $this =
    {
        'ID' => $id,
    };

    bless $this, $class;

    return $this;
}

sub clear_vars
{
    my $this = shift;

    my $id = $this->{'ID'};

    {
        no strict;
        no warnings;

        %{__PACKAGE__ . "::Sandbox" . $id . "::"} = ();
    }
}

sub set_scalar
{
    my $this = shift;
    my $var = shift;
    my $val = shift;

    my $id = $this->{'ID'};

    {
        no strict;
        no warnings;

        *{__PACKAGE__ . "::Sandbox" . $id . "::" . $var} = \$val;
    }
}

sub get_scalar
{
    my $this = shift;
    my $var = shift;

    my $id = $this->{'ID'};

    {
        no strict;
        no warnings;

        return ${__PACKAGE__ . "::Sandbox" . $id . "::" . $var};
    }
}

sub set_ref
{
    my $this = shift;
    my $var = shift;
    my $ref = shift;

    my $id = $this->{'ID'};

    {
        no strict;
        no warnings;

        *{__PACKAGE__ . "::Sandbox" . $id . "::" . $var} = $ref;
    }
}

# TODO: amling, default this?
sub import_registry
{
    my $this = shift;

    for my $token (App::RecordStream::DomainLanguage::Registry::get_tokens())
    {
        my $subref = sub
        {
            my $value = App::RecordStream::DomainLanguage::Registry::evaluate($token, @_);

            # this is somewhat terrible...
            my @pp = $value->get_possible_pairs();
            if(!@_ && !@pp)
            {
                # The idea is this... if they use a field name that doesn't
                # conflict with a nullary function then we pretend it was a
                # barewords scalar.

                # Unfortunately this means e.g.  "rec" is indistinguishable
                # between the valuation that returns the "rec" field and the
                # valuation that returns the current record.  We allow the
                # "rec" field possibility via the explicit "valuation" ctor.
                $value->add_possibility('SCALAR', $token);
            }

            return $value;
        };
        $this->set_ref($token, $subref);
        $this->set_ref("_$token", $subref); # for e.g.  "last" which is reserved
    }
}

sub exec
{
    my $__MY__this = shift;
    my $__MY__code = shift;

    $__MY__code = App::RecordStream::Executor->transform_code($__MY__code);

    my $__MY__id = $__MY__this->{'ID'};

    my $__MY__code_packaged = "package " . __PACKAGE__ . "::Sandbox$__MY__id; $__MY__code";
    my $__MY__ret;

    {
        no strict;
        no warnings;

        $__MY__ret = eval $__MY__code_packaged;

        if($@)
        {
            die $@;
        }
    }

    return $__MY__ret;
}

1;
