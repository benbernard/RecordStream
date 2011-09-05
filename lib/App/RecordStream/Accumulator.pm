package App::RecordStream::Accumulator;

our $VERSION = "3.4";

sub accept_record {
   my $this = shift;
   $this->accumulate_record(shift);
}

sub accumulate_record {
   my $this = shift;
   push @{$this->get_records()}, shift;
}

sub get_records {
   my $this = shift;

   $this->{'RECORDS'} ||= [];
   return $this->{'RECORDS'};
}

1;
