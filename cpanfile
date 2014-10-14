# The core requirements include the "essential" input/output and manipulation
# operations, such as recs-fromcsv and recs-annotate.
requires 'Carp';
requires 'Cwd';
requires 'Data::Dumper';
requires 'Date::Manip';             # recs-normalizetime (historically)
requires 'File::Basename';
requires 'File::Glob';
requires 'File::Temp';              # recs-tognuplot, but package is core Perl
requires 'FindBin';
requires 'Getopt::Long';
requires 'IO::String';
requires 'JSON::MaybeXS', '1.002005';
requires 'Module::Pluggable::Object', '5.1';
requires 'Scalar::Util';
requires 'Text::Autoformat';
requires 'Text::CSV';
requires 'Tie::Array';
requires 'Tie::Hash';               # includes Tie::ExtraHash

# XS deps
recommends 'Cpanel::JSON::XS';
recommends 'Text::CSV_XS', '0.99';
recommends 'Term::ReadKey';

on 'configure' => sub {
    requires 'ExtUtils::MakeMaker';
};

on 'test' => sub {
    requires 'Test::More';
};

on 'develop' => sub {
    requires 'Dist::Milla';
    requires 'Dist::Zilla::PluginBundle::Filter';
    requires 'Dist::Zilla::Plugin::CustomLicense';
    requires 'Dist::Zilla::Plugin::ExecDir';
    requires 'Dist::Zilla::Plugin::MakeMaker::Awesome';
    requires 'Dist::Zilla::Plugin::MetaNoIndex';
    requires 'Dist::Zilla::Plugin::MetaResources';
    requires 'Dist::Zilla::Plugin::PruneFiles';
    requires 'Dist::Zilla::Plugin::Run::BeforeBuild';
    requires 'File::Find';
};

feature 'recs-fromapache', 'Apache log parsing' => sub {
    requires 'Apache::Log::Parser';
    suggests 'Woothee';
};

feature 'recs-fromdb and recs-todb', 'SQL database support' => sub {
    requires 'DBI';
    requires 'Tie::IxHash';
    suggests 'DBD::SQLite';
};

feature 'recs-frommongo', 'MongoDB data source' => sub {
    requires 'MongoDB';
    requires 'JSON::PP';
};

feature 'recs-fromps', 'Process list data source' => sub {
    requires 'Proc::ProcessTable';
};

feature 'recs-fromtcpdump', 'Network packet capture parsing' => sub {
    requires 'Net::DNS::Packet';
    requires 'NetPacket::ARP';
    requires 'NetPacket::Ethernet';
    requires 'NetPacket::IP';
    requires 'NetPacket::TCP';
    requires 'NetPacket::UDP';
    requires 'Net::Pcap';
};

feature 'recs-fromxferlog', 'Transfer (xfer) log parsing' => sub {
    requires 'Net::FTPServer::XferLog';
};

feature 'recs-fromxml and recs-fromatomfeeds', 'XML/Atom sources' => sub {
    requires 'HTTP::Request';
    requires 'List::MoreUtils';
    requires 'LWP::UserAgent';
    requires 'XML::Twig';
};

feature 'recs-togdgraph', 'GD graph output' => sub {
    requires 'GD::Graph';
    requires "GD::Graph::$_"
        for qw(lines bars points);
};
