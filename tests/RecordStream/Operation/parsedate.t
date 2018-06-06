use strict;
use warnings;

use Test::More;
use App::RecordStream::Test::OperationHelper;
use App::RecordStream::Operation::parsedate;

BEGIN {
  # Normalize localtime for testing
  $ENV{TZ}      = 'US/Pacific';

  # This may cause warnings if en_US isn't available on a system running these
  # tests, but it's the only way to standardize testing for --pretty.
  $ENV{LC_TIME} = 'en_US';
}

# These tests aim to exercise the interplay of recs-provided options to
# parsedate to ensure they're working correctly, not test Time::ParseDate's
# functionality which is proven elsewhere.

note 'Formatting presets';
{
  my @args = qw[ -k when --from-tz UTC ];

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@args, qw[ --iso ]],
    '{"when":"2016-02-28 18:45:18"}',
    '{"when":"2016-02-28T10:45:18-0800"}',
    "--iso: 2016-02-28 18:45:18 is 2016-02-28T10:45:18-0800",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@args, qw[ --epoch ]],
    '{"when":"2016-02-28 18:45:18"}',
    '{"when":"1456685118"}',
    "--epoch 2016-02-28 18:45:18 is 1456685118",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@args, qw[ --pretty ]],
    '{"when":"2016-02-28 18:45:18"}',
    '{"when":"Sun 28 Feb 2016 10:45:18 AM PST"}',
    "--pretty 2016-02-28 18:45:18 is Sun 28 Feb 2016 10:45:18 AM PST",
  );
}

note 'Timezones';
{
  my @args = qw[ -k when --format %T ];

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@args],
    '{"when":"Feb 23 21:51:47 2016"}',
    '{"when":"21:51:47"}',
    "Feb 23 21:51:47 2016 (assuming \$ENV{TZ} = $ENV{TZ}) is 21:51:47 PST",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@args, qw[ --to-tz UTC ]],
    '{"when":"Feb 23 21:51:47 2016"}',
    '{"when":"05:51:47"}',
    "Feb 23 21:51:47 2016 (assuming \$ENV{TZ} = $ENV{TZ}) is 05:51:47 UTC",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@args, qw[ --from-tz UTC ]],
    '{"when":"Feb 23 21:51:47 2016"}',
    '{"when":"13:51:47"}',
    "Feb 23 21:51:47 2016 (with --from-tz UTC) is 13:51:47 PST",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@args, qw[ --from-tz UTC --to-tz UTC ]],
    '{"when":"Feb 23 21:51:47 2016"}',
    '{"when":"21:51:47"}',
    "Feb 23 21:51:47 2016 (with --from-tz UTC) is 21:51:47 UTC",
  );
}

note 'MDY vs DMY';
{
  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [qw[ -k when --format %F ]],
    '{"when":"10/5/2015"}',
    '{"when":"2015-10-05"}',
    "10/5/2015 is 2015-10-05",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [qw[ -k when --format %F --dmy ]],
    '{"when":"10/5/2015"}',
    '{"when":"2015-05-10"}',
    "10/5/2015 is 2015-05-10 with --dmy",
  );
};

note '--relative: Friday';
{
  my @relative = qw[ --relative -k when --format %F --now 1456293091 ]; # Tue Feb 23 21:51:47 PST 2016

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@relative],
    '{"when":"friday"}',
    '{"when":null}',
    "Friday is undef without --future or --past",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@relative, "--future"],
    '{"when":"friday"}',
    '{"when":"2016-02-26"}',
    "Friday is 2016-02-26 with --future",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@relative, "--past"],
    '{"when":"friday"}',
    '{"when":"2016-02-19"}',
    "Friday is 2016-02-19 with --past",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@relative, "--future", "--to-tz", "UTC"],
    '{"when":"friday"}',
    '{"when":"2016-02-27"}',
    "Friday is 2016-02-27 with --future --to-tz UTC",
  );
}

note '--relative: +2d';
{
  my @relative = qw[ --relative -k when --format %F --now 1456293091 ]; # Tue Feb 23 21:51:47 PST 2016

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@relative],
    '{"when":"+2 days"}',
    '{"when":"2016-02-25"}',
    "Friday is 2016-02-25 without --future or --past",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@relative, "--future"],
    '{"when":"+2 days"}',
    '{"when":"2016-02-25"}',
    "Friday is 2016-02-25 with --future",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [@relative, "--past"],
    '{"when":"+2 days"}',
    '{"when":"2016-02-25"}',
    "Friday is 2016-02-25 with --past",
  );
}

# XXX TODO
#   https://github.com/benbernard/RecordStream/pull/74
#   https://github.com/bestpractical/hiveminder/blob/master/lib/BTDT/DateTime.pm#L163-L186
#   https://metacpan.org/pod/distribution/Date-Manip/lib/Date/Manip/DM5.pod#ParseDate
note 'Special handling';
{
  # ISO8601
  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [qw[ -k when --to-tz UTC --format ], '%F %T'],
    '{"when":"2016-02-28T10:45:18-0800"}',
    '{"when":"2016-02-28 18:45:18"}',
    "2016-02-28T10:45:18-0800 is 2016-02-28 18:45:18",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [qw[ -k when --to-tz UTC --format ], '%F %T'],
    '{"when":"2016-02-28T10:45:18"}',
    '{"when":"2016-02-28 18:45:18"}',
    "2016-02-28T10:45:18 is 2016-02-28 18:45:18",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [qw[ -k when --to-tz UTC --format ], '%F %T'],
    '{"when":"2016-02-28T10:45:18Z"}',
    '{"when":"2016-02-28 10:45:18"}',
    "2016-02-28T10:45:18Z is 2016-02-28 10:45:18",
  );

  # epochs... unparseable without special casing?
  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [qw[ -k when --to-tz UTC --format ], '%F %T'],
    '{"when":"1456685118"}',
    '{"when":"2016-02-28 18:45:18"}',
    "1456685118 is 2016-02-28 18:45:18",
  );
};

note 'Bug: datetimes on and around the epoch';
{
  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [qw[ -k when --tz UTC --epoch ]],
    '{"when":"1970-01-01 00:00:00"}',
    '{"when":"0"}',
    "1970-01-01 00:00:00 is 0s from epoch",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [qw[ -k when --tz UTC --epoch ]],
    '{"when":"1970-01-01 00:00:01"}',
    '{"when":"1"}',
    "1970-01-01 00:00:01 is 1s from epoch",
  );

  App::RecordStream::Test::OperationHelper->do_match(
    'parsedate',
    [qw[ -k when --tz UTC --epoch ]],
    '{"when":"1969-12-31 23:59:59"}',
    '{"when":"-1"}',
    "1969-12-31 23:59:59 is -1s from epoch",
  );
}

done_testing;
