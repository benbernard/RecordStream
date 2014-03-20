use App::RecordStream::Test::Tester;

BEGIN {
  eval {
    require Net::FTPServer::XferLog;
  };

  if ( $@ ) {
    require Test::More;
    import Test::More skip_all => 'Missing Net::FTPServer::XferLog Modules!';
  }
  else {
    require Test::More;
    import Test::More qw(no_plan);
    use_ok( 'App::RecordStream::Operation::fromxferlog' );
  }
};

my $tester = App::RecordStream::Test::Tester->new('fromxferlog');

my $input;
my $output;

$input = <<INPUT;
Mon Oct  1 17:09:23 2001 0 127.0.0.1 2611 FILENAME a _ o r tmbranno ftp 0 * c
Mon Oct  1 17:09:27 2001 0 127.0.0.1 22   NAMEFILE a _ o r tmbranno ftp 0 * c
Mon Oct  1 17:09:27 2001 0 127.0.0.1 22   file with spaces in it.zip a _ o r tmbranno ftp 0 * c
Mon Oct  1 17:09:31 2001 0 127.0.0.1 7276 p1774034_11i_zhs.zip a _ o r tmbranno ftp 0 * c
INPUT
$output = <<OUTPUT;
{"file_size":"2611","remote_host":"127.0.0.1","month":"Oct","current_time":"17:09:23","special_action_flag":"_","day_name":"Mon","direction":"o","service_name":"ftp","day":"1","access_mode":"r","completion_status":"c","authenticated_user_id":"*","transfer_type":"a","username":"tmbranno","authentication_method":"0","transfer_time":"0","filename":"FILENAME","year":"2001"}
{"file_size":"22","remote_host":"127.0.0.1","month":"Oct","current_time":"17:09:27","special_action_flag":"_","day_name":"Mon","direction":"o","service_name":"ftp","day":"1","access_mode":"r","completion_status":"c","authenticated_user_id":"*","transfer_type":"a","username":"tmbranno","authentication_method":"0","transfer_time":"0","filename":"NAMEFILE","year":"2001"}
{"file_size":"22","remote_host":"127.0.0.1","month":"Oct","current_time":"17:09:27","special_action_flag":"_","day_name":"Mon","direction":"o","service_name":"ftp","day":"1","completion_status":"c","access_mode":"r","authenticated_user_id":"*","transfer_type":"a","authentication_method":"0","username":"tmbranno","transfer_time":"0","filename":"file with spaces in it.zip","year":"2001"}
{"file_size":"7276","remote_host":"127.0.0.1","month":"Oct","current_time":"17:09:31","special_action_flag":"_","day_name":"Mon","direction":"o","service_name":"ftp","day":"1","access_mode":"r","completion_status":"c","authenticated_user_id":"*","transfer_type":"a","username":"tmbranno","authentication_method":"0","transfer_time":"0","filename":"p1774034_11i_zhs.zip","year":"2001"}
OUTPUT
$tester->test_input([], $input, $output);
