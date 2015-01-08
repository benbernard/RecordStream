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
requires 'Pod::Perldoc';
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
    requires 'Test::More', '0.88';
    requires 'IPC::Open2';
};

on 'develop' => sub {
    requires 'Dist::Zilla';

    # Generated with devel/authordeps.  It's useful to include them here with
    # the rest of our deps.
    requires 'Dist::Zilla::Plugin::CheckChangesHasContent';
    requires 'Dist::Zilla::Plugin::ConfirmRelease';
    requires 'Dist::Zilla::Plugin::ContributorsFromGit';
    requires 'Dist::Zilla::Plugin::CopyFilesFromBuild';
    requires 'Dist::Zilla::Plugin::CopyFilesFromRelease';
    requires 'Dist::Zilla::Plugin::CustomLicense';
    requires 'Dist::Zilla::Plugin::ExecDir';
    requires 'Dist::Zilla::Plugin::ExtraTests';
    requires 'Dist::Zilla::Plugin::Git::Check';
    requires 'Dist::Zilla::Plugin::Git::Commit';
    requires 'Dist::Zilla::Plugin::Git::GatherDir';
    requires 'Dist::Zilla::Plugin::Git::Push';
    requires 'Dist::Zilla::Plugin::Git::Tag';
    requires 'Dist::Zilla::Plugin::License';
    requires 'Dist::Zilla::Plugin::MakeMaker::Awesome';
    requires 'Dist::Zilla::Plugin::Manifest';
    requires 'Dist::Zilla::Plugin::ManifestSkip';
    requires 'Dist::Zilla::Plugin::MetaJSON';
    requires 'Dist::Zilla::Plugin::MetaNoIndex';
    requires 'Dist::Zilla::Plugin::MetaResources';
    requires 'Dist::Zilla::Plugin::MetaYAML';
    requires 'Dist::Zilla::Plugin::NextRelease';
    requires 'Dist::Zilla::Plugin::PodSyntaxTests';
    requires 'Dist::Zilla::Plugin::Prereqs::FromCPANfile';
    requires 'Dist::Zilla::Plugin::PruneCruft';
    requires 'Dist::Zilla::Plugin::ReadmeAnyFromPod';
    requires 'Dist::Zilla::Plugin::ReversionOnRelease';
    requires 'Dist::Zilla::Plugin::Run::AfterRelease', '0.027';
    requires 'Dist::Zilla::Plugin::Run::BeforeBuild';
    requires 'Dist::Zilla::Plugin::ShareDir';
    requires 'Dist::Zilla::Plugin::TestRelease';
    requires 'Dist::Zilla::Plugin::UploadToCPAN';
    requires 'Dist::Zilla::Plugin::VersionFromModule';

    # fatpacking
    requires 'App::FatPacker', '0.10.2';
    requires 'lib::core::only';
    requires 'List::MoreUtils';
    requires 'Module::CPANfile';
    requires 'Perl::Strip';

    # fatpacking: these should be core, but we'll include them for good measure
    requires 'Cwd';
    requires 'File::Find';
    requires 'File::Path';
    requires 'Getopt::Long';
    requires 'Module::CoreList';
    requires 'Tie::File';
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

# NetPacket only supports 5.10+
unless ($] lt '5.010') {
    feature 'recs-fromtcpdump', 'Network packet capture parsing' => sub {
        requires 'Net::DNS::Packet';
        requires 'NetPacket::ARP';
        requires 'NetPacket::Ethernet';
        requires 'NetPacket::IP';
        requires 'NetPacket::TCP';
        requires 'NetPacket::UDP';
        requires 'Net::Pcap';
    };
}

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
