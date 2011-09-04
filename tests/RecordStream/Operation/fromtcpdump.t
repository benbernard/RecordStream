use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN {
   eval { 
      require Net::Pcap;
   };

   if ( $@ ) {
      require Test::More;
      import Test::More skip_all => 'Missing Net::Pcap';
   }
   else {
      require Test::More;
      import Test::More qw(no_plan);
      use_ok( 'App::RecordStream::Operation::fromtcpdump' );
   }
};

my $solution = <<SOLUTION;
{"dns":{"answer":[],"buffer":"","question":[{"qclass":"IN","qname":"blog.benjaminbernard.com","qtype":"A"}],"answersize":42,"additional":[],"authority":[],"header":{"nscount":0,"cd":0,"qdcount":1,"ancount":0,"rcode":"NOERROR","tc":0,"opcode":"QUERY","ad":0,"ra":0,"qr":0,"arcount":0,"id":3930,"aa":0,"rd":1},"offset":42},"ip":{"hlen":5,"len":70,"proto":17,"dest_ip":"10.0.0.1","flags":{},"foffset":0,"options":"","ttl":64,"ver":4,"cksum":10544,"src_ip":"10.0.2.15","tos":0,"id":15208},"file":"tests/files/test-capture1.pcap","caplen":84,"length":84,"timestamp":"1294004869.88858","ethernet":{"src_mac":"080027e0fd58","dest_mac":"525400123502"},"udp":{"len":50,"src_port":46578,"dest_port":53,"cksum":5715},"type":"udp"}
{"dns":{"answer":[{"rdlength":4,"ttl":1800,"name":"blog.benjaminbernard.com","address":"63.251.171.81","class":"IN","type":"A","rdata":""},{"rdlength":4,"ttl":1800,"name":"blog.benjaminbernard.com","address":"69.25.27.170","class":"IN","type":"A","rdata":""},{"rdlength":4,"ttl":1800,"name":"blog.benjaminbernard.com","address":"63.251.171.80","class":"IN","type":"A","rdata":""},{"rdlength":4,"ttl":1800,"name":"blog.benjaminbernard.com","address":"69.25.27.173","class":"IN","type":"A","rdata":""},{"rdlength":4,"ttl":1800,"name":"blog.benjaminbernard.com","address":"66.150.161.141","class":"IN","type":"A","rdata":""},{"rdlength":4,"ttl":1800,"name":"blog.benjaminbernard.com","address":"66.150.161.140","class":"IN","type":"A","rdata":""}],"buffer":"","question":[{"qclass":"IN","qname":"blog.benjaminbernard.com","qtype":"A"}],"answersize":138,"additional":[],"authority":[],"header":{"nscount":0,"cd":0,"qdcount":1,"ancount":6,"rcode":"NOERROR","tc":0,"opcode":"QUERY","ad":0,"ra":1,"qr":1,"arcount":0,"id":3930,"aa":0,"rd":1},"offset":138},"ip":{"hlen":5,"len":166,"proto":17,"dest_ip":"10.0.2.15","flags":{},"foffset":0,"options":"","ttl":64,"ver":4,"cksum":23131,"src_ip":"10.0.0.1","tos":0,"id":2525},"file":"tests/files/test-capture1.pcap","caplen":180,"length":180,"timestamp":"1294004869.160748","ethernet":{"src_mac":"525400123500","dest_mac":"080027e0fd58"},"udp":{"len":146,"src_port":53,"dest_port":46578,"cksum":47199},"type":"udp"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'fromtcpdump',
   ['tests/files/test-capture1.pcap'],
   '',
   $solution,
);
