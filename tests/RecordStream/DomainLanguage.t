use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Aggregator"); }
BEGIN { use_ok("App::RecordStream::DomainLanguage::Library"); }
BEGIN { use_ok("App::RecordStream::DomainLanguage::Snippet"); }
BEGIN { use_ok("App::RecordStream::Test::DistinctCountHelper"); }
BEGIN { use_ok("App::RecordStream::Test::LastHelper"); }
BEGIN { use_ok("App::RecordStream::Test::UniqConcatHelper"); }

App::RecordStream::Aggregator::load_aggregators();

my $NO_CHECK = 'NO_CHECK';
my $CAST_FAILURE = 'CAST_FAILURE';

my @tests =
(
    [
        [
            "_last(x)",
            "_last('x')",
        ],
        sub
        {
            my $aggr = shift;

            App::RecordStream::Test::LastHelper::test_aggregator($aggr, "x");
        },
        $CAST_FAILURE,
        $CAST_FAILURE,
    ],
    [
        [
            "_dct(x)",
            "dct(x)",
            "dct('x')",
        ],
        sub
        {
            my $aggr = shift;

            App::RecordStream::Test::DistinctCountHelper::test_aggregator($aggr, "x");
        },
        $CAST_FAILURE,
        $CAST_FAILURE,
    ],
    [
        "firstrec",
        sub
        {
            my $aggr = shift;

            isa_ok($aggr, 'App::RecordStream::Aggregator::FirstRecord');
        },
        $CAST_FAILURE,
        $CAST_FAILURE,
    ],
    [
        "for_field(qr/^t/, 'sum(\$f)')",
        sub
        {
            my $aggr = shift;

            my $cookie = $aggr->initial();

            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new());
            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("t1" => 1));
            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("t2" => 3));
            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("t1" => 7, "t2" => 6));

            my $value = $aggr->squish($cookie);

            my $ans =
            {
                "t1" => 8,
                "t2" => 9,
            };

            is_deeply($value, $ans);
        },
        $CAST_FAILURE,
        $CAST_FAILURE,
    ],
    [
        "rec",
        $CAST_FAILURE,
        sub
        {
            my $valuation = shift;

            isa_ok($valuation, 'App::RecordStream::DomainLanguage::Valuation');

            for my $rec ({"foo" => "bar"}, {"zoom" => [1, 2]})
            {
                is_deeply($valuation->evaluate_record($rec), $rec);
            }
        },
        $CAST_FAILURE,
    ],
    [
        [
            "sum('ct')",
            "ii_agg('0', '\$a+{{ct}}', '\$a')",
            "ii_agg('0', '\$a+{{ct}}')",
            "inject_into_aggregator('0', '\$a+{{ct}}', '\$a')",
            "inject_into_aggregator('0', '\$a+{{ct}}')",
        ],
        sub
        {
            my $aggr = shift;

            my $cookie = $aggr->initial();

            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("ct" => 1));
            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("ct" => 2));
            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("ct" => 3));

            my $value = $aggr->squish($cookie);

            is_deeply($value, 6);
        },
        $CAST_FAILURE,
        $CAST_FAILURE,
    ],
    [
        [
            "avg('ct')",
            "ii_agg('[0, 0]', '[\$a->[0] + 1, \$a->[1] + {{ct}}]', '\$a->[1] / \$a->[0]')",
            "inject_into_aggregator('[0, 0]', '[\$a->[0] + 1, \$a->[1] + {{ct}}]', '\$a->[1] / \$a->[0]')",
        ],
        sub
        {
            my $aggr = shift;

            my $cookie = $aggr->initial();

            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("ct" => 1));
            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("ct" => 2));
            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("ct" => 3));
            $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("ct" => 4));

            my $value = $aggr->squish($cookie);

            is_deeply($value, 2.5);
        },
        $CAST_FAILURE,
        $CAST_FAILURE,
    ],
    [
        "sum(ct)",
        $CAST_FAILURE,
        $CAST_FAILURE,
        $CAST_FAILURE,
    ],
    [
        "uconcat(',',x)",
        sub
        {
            my $aggr = shift;

            App::RecordStream::Test::UniqConcatHelper::test_aggregator($aggr);
        },
        $CAST_FAILURE,
        $CAST_FAILURE,
    ],
    [
        "uconcat(',', snip('{{x}}'))",
        sub
        {
            my $aggr = shift;

            App::RecordStream::Test::UniqConcatHelper::test_aggregator($aggr);
        },
        $CAST_FAILURE,
        $CAST_FAILURE,
    ],
);

for my $test (@tests)
{
    my ($codes, $agg_check, $val_check, $scalar_check) = @$test;
    if(!ref($codes))
    {
        $codes = [$codes];
    }
    for my $code (@$codes)
    {
        my $snip = App::RecordStream::DomainLanguage::Snippet->new($code);
        for my $sub_test (['AGG', $agg_check], ['VALUATION', $val_check], ['SCALAR', $scalar_check])
        {
            my ($type, $check) = @$sub_test;

            my $r;
            eval
            {
                $r = $snip->evaluate_as($type);
            };
            if($@)
            {
                my $fail = $@;
                if(ref($check) && ref($check) eq "CODE")
                {
                    fail("'$code' as '$type' failed: $fail");
                }
                elsif($check && $check eq $NO_CHECK)
                {
                }
                elsif($check && $check eq $CAST_FAILURE)
                {
                    if($fail =~ /( found where .* expected)|(^No .* possibilities)/)
                    {
                        # OK
                    }
                    else
                    {
                        fail("'$code' as '$type' failed, expected cast failure: $fail");
                    }
                }
                else
                {
                    fail("'$code', '$type' => no expectation, failed: $fail");
                }
            }
            else
            {
                if(ref($check) && ref($check) eq "CODE")
                {
                    $check->($r);
                }
                elsif($check && $check eq $NO_CHECK)
                {
                    fail("'$code' as '$type' succeeded, expected cast failure: " . Dumper($r));
                }
                else
                {
                    fail("'$code', '$type' => no expectation, succeeded: " . Dumper($r));
                }
            }
        }
    }
}
