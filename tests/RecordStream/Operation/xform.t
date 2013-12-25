use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::xform' ) };

my $input = <<INPUT;
{"a":"a1,a2","b":"b1"}
{"a":"a3,a4,a5","b":"b2"}
INPUT

my $output;

$output = <<OUTPUT;
{"a":"a0","b":"b1"}
{"a":"a0","b":"b2"}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['$r->{a} = "a0";'],
    $input,
    $output
);

$output = <<OUTPUT;
{"a":"a0","b":"b1"}
{"a":"a0","b":"b2"}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['$r->{a} = "a0"; [{}]'],
    $input,
    $output
);

$output = <<OUTPUT;
{}
{}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['$r->{a} = "a0"; $r = [{}]'],
    $input,
    $output
);

$output = <<OUTPUT;
{"a":"a1","b":"b1"}
{"a":"a2","b":"b1"}
{"a":"a3","b":"b2"}
{"a":"a4","b":"b2"}
{"a":"a5","b":"b2"}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['-e', '$r = [map { {%$r, "a" => $_} } split(/,/, delete($r->{"a"}))]; 1;'],
    $input,
    $output
);

$output = <<OUTPUT;
{"a":"a1,a2","b":"b1","foo":"bar"}
{"a":"a3,a4,a5","b":"b2","foo":"bar"}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['-E', 'tests/files/executorCode'],
    $input,
    $output
);

$output = <<OUTPUT;
{"a":"a1,a2","b":"b1","reduced":12}
{"a":"a3,a4,a5","b":"b2","reduced":690}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['-MList::Util=reduce', '{{reduced}} = reduce { $a * $b } map { (my $tmp = $_) =~ s/\D//g; $tmp } values %$r'],
    $input,
    $output
);

$output = <<OUTPUT;
{"a":"a1,a2","b":"b1","before":null}
{"a":"a3,a4,a5","b":"b2", "before":"b1"}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['-B', 1, '{{before}} = $B->[0]->{"b"}'],
    $input,
    $output
);

$output = <<OUTPUT;
{"a":"a1,a2","b":"b1","after":"b2"}
{"a":"a3,a4,a5","b":"b2", "after":null}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['-A', 1, '{{after}} = $A->[0]->{"b"}'],
    $input,
    $output
);

$input = <<INPUT;
{"a":"a1","b":"b1"}
{"a":"a2","b":"b1"}
{"a":"a3","b":"b2"}
{"a":"a4","b":"b2"}
{"a":"a5","b":"b2"}
INPUT

$output = <<OUTPUT;
{"after":"a2","a":"a1","b":"b1","before":null}
{"after":"a3","a":"a2","b":"b1","before":"a1"}
{"after":"a4","a":"a3","b":"b2","before":"a2"}
{"after":"a5","a":"a4","b":"b2","before":"a3"}
{"after":null,"a":"a5","b":"b2","before":"a4"}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['-C', 1, '{{after}} = $A->[0]->{"a"}; {{before}} = $B->[0]->{"a"}'],
    $input,
    $output
);


$input = <<INPUT;
{"a":"a1","b":"b1"}
{"a":"a2","b":"b1"}
INPUT

$output = <<OUTPUT;
{"foo":"bar"}
{"a":"a1c","b":"b1"}
{"a":"a2c","b":"b1"}
OUTPUT
App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['--pre', 'push_output({foo=>"bar"})', '{{a}} .= "c"'],
    $input,
    $output
  );

  $output = <<OUTPUT;
{"a":"a1c","b":"b1"}
{"a":"a2c","b":"b1"}
{"foo":"bar"}
OUTPUT
  App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['--post', 'push_output({foo=>"bar"})', '{{a}} .= "c"'],
    $input,
    $output
  );

  $output = <<OUTPUT;
{"a":"a1c","b":"b1"}
{"a":"a2c","b":"b1"}
{"foo":"bar","a":"c"}
OUTPUT
  App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['--post', 'push_input({foo=>"bar"})', '{{a}} .= "c"'],
    $input,
    $output
  );

  $output = <<OUTPUT;
{"a":"a1","b":"b1","foo":"zipper"}
{"a":"a2","b":"b1","foo":"zipper"}
OUTPUT
  App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['--pre', '$foo = "zipper"', '{{foo}} .= $foo'],
    $input,
    $output
  );

  $output = <<OUTPUT;
{"a":"a2","b":"b1","foo":"zipper"}
OUTPUT
  App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['if(!$later){push_output();$later=1}; {{foo}} = "zipper"'],
    $input,
    $output
  );

  $output = <<OUTPUT;
{"foo":"bar","a":"c"}
OUTPUT
  App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['--post', 'push_input({foo=>"bar"})', '{{a}} = "c"'],
    '',
    $output
  );

  $output = <<OUTPUT;
{"foo":"bar","a":"c"}
OUTPUT
  App::RecordStream::Test::OperationHelper->do_match(
    'xform',
    ['--pre', 'push_input({foo=>"bar"})', '{{a}} = "c"'],
    '',
    $output
  );
