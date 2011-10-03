package App::RecordStream::Stream::Printer;

use App::RecordStream::Stream::Base;

use base 'App::RecordStream::Stream::Base';

sub accept_line
{
    my $this = shift;
    my $line = shift;

    print "$line\n";

    return 1;
}

1;
