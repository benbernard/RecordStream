use App::RecordStream::Operation::fromcsv;
if (@ARGV) {
  print join(" ", @ARGV), "\n";
} else {
  print $INC{'App/RecordStream/Operation/fromcsv.pm'}, "\n";
}
