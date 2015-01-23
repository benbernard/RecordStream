package App::RecordStream::Operation::fromtcpdump;

our $VERSION = "4.0.11";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::OptionalRequire qw(NetPacket::Ethernet :ALL);
use App::RecordStream::OptionalRequire qw(NetPacket::IP :ALL);
use App::RecordStream::OptionalRequire qw(NetPacket::TCP :ALL);
use App::RecordStream::OptionalRequire qw(NetPacket::UDP :ALL);
use App::RecordStream::OptionalRequire qw(NetPacket::ARP :ALL);
use App::RecordStream::OptionalRequire qw(Net::Pcap pcap_open_offline pcap_loop pcap_next_ex);
use App::RecordStream::OptionalRequire qw(Net::DNS::Packet);
App::RecordStream::OptionalRequire::require_done();

use Data::Dumper;

# From NetPacket::IP
my $IP_FLAGS = {
  'more_fragments' => IP_FLAG_MOREFRAGS,
  'dont_fragment'  => IP_FLAG_DONTFRAG,
  'congestion'     => IP_FLAG_CONGESTION,
};

# From NetPacket::TCP
my $TCP_FLAGS = {
  FIN => FIN,
  SYN => SYN,
  RST => RST,
  PSH => PSH,
  ACK => ACK,
  URG => URG,
  ECE => ECE,
  CWR => CWR,
};

# From NetPacket::ARP_OPCODES
my $ARP_OPCODES = {
  +ARP_OPCODE_REQUEST  , 'ARP_REQUEST',
  +ARP_OPCODE_REPLY    , 'ARP_REPLY',
  +RARP_OPCODE_REQUEST , 'RARP_REQUEST',
  +RARP_OPCODE_REPLY   , 'RARP_REPLY',
};

my $DEFAULT_SUPPRESSED_FIELDS = [qw(data _frame _parent type)];

sub init {
  my $this = shift;
  my $args = shift;

  my $data = 0;
  my $spec = {
    'data' => \$data,
  };

  $this->parse_options($args, $spec);

  if ( ! @$args ) {
    die "Missing capture file\n";
  }

  $this->{'FILES'} = $args;
  $this->{'DATA'}  = $data;
}

sub wants_input {
  return 0;
}

sub stream_done {
  my $this = shift;

  foreach my $filename ( @{$this->{'FILES'}} ) {
    $this->update_current_filename($filename);
    # TODO: have a connections output rather than packets
    $this->dump_packets($filename);
  }
}

sub dump_packets {
  my $this = shift;
  my $file = shift;

  my $error;
  my $pcap = pcap_open_offline($file, \$error);

  die $error if ( $error );

  my ($raw_packet, %header);
  while(pcap_next_ex($pcap, \%header, \$raw_packet) == 1) {

    my $record = {
      'length' => $header{'len'},
      'caplen' => $header{'caplen'},
      'file'   => $file,
    };

    if ( $header{'tv_sec'} ) {
      $record->{'timestamp'} = join('.', $header{'tv_sec'}, $header{'tv_usec'});
    }

    $this->push_record($this->create_packet_record($raw_packet, $record));
  }
}

# Packet parsing courtesy of Net::Analysis
sub create_packet_record {
  my $this   = shift;
  my $packet = shift;
  my $record = shift;

  my ($eth_obj) = NetPacket::Ethernet->decode($packet);

  $this->propagate_fields('ethernet', $eth_obj, $record);
  my $type = 'ethernet';
  my $data = $eth_obj->{'data'};

  if ($eth_obj->{type} == ETH_TYPE_IP) {
    my $ip_obj = NetPacket::IP->decode($eth_obj->{data});
    $this->propagate_fields('ip', $ip_obj, $record, [qw(flags)]);
    $type = 'ip';
    $data = $ip_obj->{'data'};

    $record->{'ip'}->{'flags'} = $this->get_flag_list(
      $ip_obj->{'flags'},
      $IP_FLAGS,
    );

    if($ip_obj->{proto} == IP_PROTO_TCP) {
      # Some ethernet frames come with padding; this confuses NetPacket,
      #  so strip it off here before parsing the IP payload as a TCP
      #  packet.
      my $ip_data_len = $ip_obj->{len} - $ip_obj->{hlen} * 4;
      if ($ip_data_len < length($ip_obj->{data})) {
        my $truncated_data = substr($ip_obj->{'data'}, 0, $ip_data_len);
        $ip_obj->{'data'} = $truncated_data;
      }

      my $tcp_obj = NetPacket::TCP->decode($ip_obj->{data});
      $this->propagate_fields('tcp', $tcp_obj, $record);
      $type = 'tcp';
      $data = $tcp_obj->{'data'};

      $record->{'tcp'}->{'flags'} = $this->get_flag_list(
        $tcp_obj->{'flags'},
        $TCP_FLAGS,
      );

      $this->attach_dns_info($record, $tcp_obj);
    }
    elsif ( $ip_obj->{'proto'} == IP_PROTO_UDP ) {
      my $udp_obj = NetPacket::UDP->decode ($ip_obj->{data});
      $this->propagate_fields('udp', $udp_obj, $record);
      $type = 'udp';
      $data = $udp_obj->{'data'};

      $this->attach_dns_info($record, $udp_obj);
    }
  }
  elsif ( $eth_obj->{'type'} == ETH_TYPE_ARP ) {
    $type = 'arp';
    my $arp_obj = NetPacket::ARP->decode($eth_obj->{data});
    $this->propagate_fields('arp', $arp_obj, $record, [qw(opcode)]);

    my $opcode = $arp_obj->{'opcode'};
    $record->{'arp'}->{'opcode'} = $ARP_OPCODES->{$opcode};
  }

  $record->{'type'} = $type;
  $record->{'data'} = $data if ( $this->{'DATA'} );

  return App::RecordStream::Record->new($record);
}

sub attach_dns_info {
  my $this   = shift;
  my $record = shift;
  my $packet = shift;

  # Assume DNS packets happen on port 53
  unless ( $packet->{'dest_port'} == 53 || $packet->{'src_port'} == 53 ) {
    return;
  }

  my $data = $packet->{'data'};
  my $dns_packet = Net::DNS::Packet->new(\$data);
  my @answers = $dns_packet->answer();

  if ( ! $this->{'DATA'} ) {
    $dns_packet->{'buffer'} = '';
    foreach my $answer (@answers) {
      $answer->{'rdata'} = '';
    }
  }

  $record->{'dns'}             = $dns_packet;
  $record->{'dns'}->{'answer'} = \@answers;
}

sub get_flag_list {
  my $this       = shift;
  my $flags      = shift;
  my $flags_hash = shift;

  my $to_return = {};
  foreach my $name ( keys %$flags_hash ) {
    if ( $flags & $flags_hash->{$name} ) {
      $to_return->{$name} = 1;
    }
  }

  return $to_return;
}


sub propagate_fields {
  my $this             = shift;
  my $dest_key         = shift;
  my $src              = shift;
  my $dest             = shift;
  my $extra_suppressed = shift;

  my $suppressed = { map { $_ => 1 } @$DEFAULT_SUPPRESSED_FIELDS, @$extra_suppressed };

  foreach my $key (keys %$src) {
    next if ( $suppressed->{$key} );
    $dest->{$dest_key}->{$key} = $src->{$key};
  }
}

sub usage {
  my $this = shift;

  my $options = [
    [ 'data', 'Include raw data bytes of deepest packet level'],
  ];

  my $args_string = $this->options_string($options);

  my $ip_flag_names  = join(', ', sort keys %$IP_FLAGS);
  my $tcp_flag_names = join(', ', sort keys %$TCP_FLAGS);
  my $arp_opcodes    = join(', ', sort values %$ARP_OPCODES);

  return <<USAGE;
Usage: recs-fromtcpdump <file1> <file2> ...
   __FORMAT_TEXT__
   Runs tcpdump and puts out records, one for each packet.  Expects pcap
   files.  Will put the name of the originating capture file in the 'file'
   field.

   Will parse packet types: ethernet, ip, udp, arp, tcp
   The type key will indicate the highest level parsed.  DNS information will
   be parsed for TCP or UDP packets that are from or to port 53. The parsed
   representation of the packet for each valid level will be placed in the
   corresponding key.  For instance, for a tcp packet, there will be
   information in the keys 'ethernet', 'ip', and 'tcp'

   By default, data output is suppressed due to poor interaction with terminal
   programs.
   __FORMAT_TEXT__

   Flags will be parsed into hash of strings
   Possible IP flags: $ip_flag_names
   Poassible TCP flags: $tcp_flag_names

   ARP opcodes will be matched
   Possible opcodes: $arp_opcodes

Creating a pcap file:
   __FORMAT_TEXT__
   Run a tcpdump command with -w FILE to produce a pcap file.  For instance:
   sudo tcpdump -w /var/tmp/capture.pcap

   Optionally, include all the data and timing information:
   sudo tcpdump -w capture.pcap -s4096 -S -tt

   See 'man tcpdump' for more information.
   __FORMAT_TEXT__

Arguments
$args_string

Examples
   Get records for all packets
      recs-fromtcpdump  capture.pcap
USAGE
}

1;
