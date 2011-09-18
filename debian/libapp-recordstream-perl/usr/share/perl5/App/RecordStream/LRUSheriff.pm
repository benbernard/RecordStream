package App::RecordStream::LRUSheriff;

our $VERSION = "3.4";

use strict;
use lib;

sub new
{
   my $class = shift;

   my $this = { };

   $this->{'hr'} = { };
   $this->{'head'} = undef;
   $this->{'tail'} = undef;
   $this->{'ct'} = 0;

   bless $this, $class;

   return $this;
}

sub find
{
   my ($this, $k) = @_;

   my $data = $this->{'hr'}->{$k};

   if($data)
   {
      $this->_unlink($data->[0]);
      $this->_head($data->[0]);
      return $data->[1];
   }

   return undef;
}

sub put
{
   my ($this, $k, $v) = @_;

   my $data = $this->{'hr'}->{$k};
   if($data)
   {
      $data->[1] = $v;
      $this->_unlink($data->[0]);
      $this->_head($data->[0]);
      return;
   }

   my $node = [undef, undef, $k];
   $this->_head($node);
   $this->{'hr'}->{$k} = [$node, $v];
}

sub _unlink
{
   my ($this, $node) = @_;

   if($node->[0])
   {
      $node->[0]->[1] = $node->[1];
   }
   else
   {
      $this->{'head'} = $node->[1];
   }

   if($node->[1])
   {
      $node->[1]->[0] = $node->[0];
   }
   else
   {
      $this->{'tail'} = $node->[0];
   }

   --$this->{'ct'};
}

sub _head
{
   my ($this, $node) = @_;

   $node->[0] = undef;
   $node->[1] = $this->{'head'};
   $this->{'head'} = $node;
   if($node->[1])
   {
      $node->[1]->[0] = $node;
   }
   else
   {
      $this->{'tail'} = $node;
   }

   ++$this->{'ct'};
}

sub purgenate
{
   my ($this, $size) = @_;

   my @goners;
   while($this->{'ct'} > $size)
   {
      my $node = $this->{'tail'};
      $this->_unlink($node);
      my $key = $node->[2];
      my $data = delete $this->{'hr'}->{$key};
      push @goners, $data->[1];
   }

   return @goners;
}

1;
