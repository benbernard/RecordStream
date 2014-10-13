package Date::Manip::Delta;
# Copyright (c) 1995-2014 Sullivan Beck. All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

########################################################################
# Any routine that starts with an underscore (_) is NOT intended for
# public use.  They are for internal use in the the Date::Manip
# modules and are subject to change without warning or notice.
#
# ABSOLUTELY NO USER SUPPORT IS OFFERED FOR THESE ROUTINES!
########################################################################

use Date::Manip::Obj;
@ISA = ('Date::Manip::Obj');

require 5.010000;
use warnings;
use strict;
use utf8;
use IO::File;
#use re 'debug';

use Date::Manip::Base;
use Date::Manip::TZ;

our $VERSION;
$VERSION='6.47';
END { undef $VERSION; }

########################################################################
# BASE METHODS
########################################################################

sub is_delta {
   return 1;
}

sub config {
   my($self,@args) = @_;
   $self->SUPER::config(@args);

   # A new config can change the value of the format fields, so clear them.
   $$self{'data'}{'f'}    = {};
   $$self{'data'}{'flen'} = {};
}

# Call this every time a new delta is put in to make sure everything is
# correctly initialized.
#
sub _init {
   my($self) = @_;

   my $def = [0,0,0,0,0,0,0];
   my $dmt = $$self{'tz'};
   my $dmb = $$dmt{'base'};

   $$self{'err'}  = '';
   $$self{'data'} = {
                     'delta'      => $def,  # the delta (all negative fields signed)
                     'in'         => '',    # the string that was parsed (if any)
                     'length'     => 0,     # length of delta (in seconds)

                     'gotmode'    => 0,     # 1 if mode set explicitly
                     'business'   => 0,     # 1 for a business delta

                     'f'          => {},    # format fields
                     'flen'       => {},    # field lengths
                    }
}

sub _init_args {
   my($self) = @_;

   my @args = @{ $$self{'args'} };
   if (@args) {
      if ($#args == 0) {
         $self->parse($args[0]);
      } else {
         warn "WARNING: [new] invalid arguments: @args\n";
      }
   }
}

sub value {
   my($self) = @_;
   my $dmt = $$self{'tz'};
   my $dmb = $$dmt{'base'};

   return undef  if ($$self{'err'});
   if (wantarray) {
      return @{ $$self{'data'}{'delta'} };
   } else {
      my @delta = @{ $$self{'data'}{'delta'} };
      my $err;
      ($err,@delta) = $dmb->_delta_fields( { 'nonorm'  => 1,
                                             'source'  => 'delta',
                                             'sign'    => 0 },
                                           [@delta]);
      return undef  if ($err);
      return join(':',@delta);
   }
}

sub input {
   my($self) = @_;
   return  $$self{'data'}{'in'};
}

########################################################################
# DELTA METHODS
########################################################################

BEGIN {
   my %ops = map { $_,1 } qw( delta business normal standard );
   my %f   = qw( y 0  M 1  w 2  d 3  h 4  m 5  s 6 );

   sub set {
      my($self,$field,$val,$no_normalize) = @_;

      my $dmt        = $$self{'tz'};
      my $dmb        = $$dmt{'base'};
      my $zone       = $$self{'data'}{'tz'};
      my $gotmode    = $$self{'data'}{'gotmode'};
      my $business   = 0;

      my (@delta,$err);

      if (exists $ops{lc($field)}) {
         $field       = lc($field);

         if ($field eq 'business') {
            $business = 1;
            $gotmode  = 1;
         } elsif ($field eq 'normal'  ||  $field eq 'standard') {
            $business = 0;
            $gotmode  = 1;
         } elsif ($field eq 'delta') {
            $business = $$self{'data'}{'business'};
            $gotmode  = $$self{'data'}{'gotmode'};
         }

         ($err,@delta) = $dmb->_delta_fields( { 'nonorm'   => $no_normalize,
                                                'business' => $business,
                                                'source'   => 'delta',
                                                'sign'     => -1 },
                                              $val);

      } elsif (exists $f{$field}) {

         if ($$self{'err'}) {
            $$self{'err'} = "[set] Invalid delta";
            return 1;
         }

         @delta             = @{ $$self{'data'}{'delta'} };
         $business          = $$self{'data'}{'business'};
         $delta[$f{$field}] = $val;

         ($err,@delta) = $dmb->_delta_fields( { 'nonorm'   => $no_normalize,
                                                'business' => $business,
                                                'source'   => 'delta',
                                                'sign'     => -1 },
                                              [@delta]);

      } elsif (lc($field) eq 'mode') {

         @delta             = @{ $$self{'data'}{'delta'} };
         $val               = lc($val);
         if ($val eq 'business'  ||  $val eq 'normal'  ||  $val eq 'standard') {
            $gotmode        = 1;
            $business       = ($val eq 'business' ? 1 : 0);

         } else {
            $$self{'err'} = "[set] Invalid mode: $val";
            return 1;
         }

      } else {

         $$self{'err'} = "[set] Invalid field: $field";
         return 1;

      }

      if ($err) {
         $$self{'err'} = "[set] Invalid field value: $field";
         return 1;
      }

      $self->_init();
      $$self{'data'}{'delta'}      = [ @delta ];
      $$self{'data'}{'business'}   = $business;
      $$self{'data'}{'gotmode'}    = $gotmode;
      $$self{'data'}{'length'}     = 'unknown';

      return 0;
   }
}

sub _rx {
   my($self,$rx) = @_;
   my $dmt = $$self{'tz'};
   my $dmb = $$dmt{'base'};

   return $$dmb{'data'}{'rx'}{'delta'}{$rx}
     if (exists $$dmb{'data'}{'rx'}{'delta'}{$rx});

   if ($rx eq 'expanded') {
      my $sign    = '[-+]?\s*';
      my $sep     = '(?:,\s*|\s+|$)';

      my $nth     = $$dmb{'data'}{'rx'}{'nth'}[0];
      my $yf      = $$dmb{data}{rx}{fields}[1];
      my $mf      = $$dmb{data}{rx}{fields}[2];
      my $wf      = $$dmb{data}{rx}{fields}[3];
      my $df      = $$dmb{data}{rx}{fields}[4];
      my $hf      = $$dmb{data}{rx}{fields}[5];
      my $mnf     = $$dmb{data}{rx}{fields}[6];
      my $sf      = $$dmb{data}{rx}{fields}[7];
      my $num     = '(?:\d+(?:\.\d*)?|\.\d+)';

      my $y       = "(?:(?:(?<y>$sign$num)|(?<y>$nth))\\s*(?:$yf)$sep)";
      my $m       = "(?:(?:(?<m>$sign$num)|(?<m>$nth))\\s*(?:$mf)$sep)";
      my $w       = "(?:(?:(?<w>$sign$num)|(?<w>$nth))\\s*(?:$wf)$sep)";
      my $d       = "(?:(?:(?<d>$sign$num)|(?<d>$nth))\\s*(?:$df)$sep)";
      my $h       = "(?:(?:(?<h>$sign$num)|(?<h>$nth))\\s*(?:$hf)$sep)";
      my $mn      = "(?:(?:(?<mn>$sign$num)|(?<mn>$nth))\\s*(?:$mnf)$sep)";
      my $s       = "(?:(?:(?<s>$sign$num)|(?<s>$nth))\\s*(?:$sf)?)";

      my $exprx   = qr/^\s*$y?$m?$w?$d?$h?$mn?$s?\s*$/i;
      $$dmb{'data'}{'rx'}{'delta'}{$rx} = $exprx;

   } elsif ($rx eq 'mode') {

      my $mode = qr/\b($$dmb{'data'}{'rx'}{'mode'}[0])\b/i;
      $$dmb{'data'}{'rx'}{'delta'}{$rx} = $mode;

   } elsif ($rx eq 'when') {

      my $when = qr/\b($$dmb{'data'}{'rx'}{'when'}[0])\b/i;
      $$dmb{'data'}{'rx'}{'delta'}{$rx} = $when;

   }

   return $$dmb{'data'}{'rx'}{'delta'}{$rx};
}

sub parse {
   my($self,$instring,@args) = @_;
   my($business,$no_normalize,$gotmode,$err,@delta);

   if (@args == 2) {
      ($business,$no_normalize) = (lc($args[0]),lc($args[1]));
      if      ($business eq 'standard') {
         $business = 0;
      } elsif ($business eq 'business') {
         $business = 1;
      } elsif ($business) {
         $business = 1;
      } else {
         $business = 0;
      }
      if ($no_normalize) {
         $no_normalize = 1;
      } else {
         $no_normalize = 0;
      }
      $gotmode = 1;

   } elsif (@args == 1) {
      my $arg = lc($args[0]);
      if      ($arg eq 'standard') {
         $business     = 0;
         $no_normalize = 0;
         $gotmode      = 1;
      } elsif ($arg eq 'business') {
         $business     = 1;
         $no_normalize = 0;
         $gotmode      = 1;
      } elsif ($arg eq 'nonormalize') {
         $business     = 0;
         $no_normalize = 1;
         $gotmode      = 0;
      } elsif ($arg) {
         $business     = 1;
         $no_normalize = 0;
         $gotmode      = 1;
      } else {
         $business     = 0;
         $no_normalize = 0;
         $gotmode      = 0;
      }
   } elsif (@args == 0) {
      $business     = 0;
      $no_normalize = 0;
      $gotmode      = 0;
   } else {
      $$self{'err'} = "[parse] Unknown arguments";
      return 1;
   }

   my $dmt = $$self{'tz'};
   my $dmb = $$dmt{'base'};
   $self->_init();

   if (! $instring) {
      $$self{'err'} = '[parse] Empty delta string';
      return 1;
   }

   #
   # Parse the string
   #

   $$self{'err'} = '';
   $instring     =~ s/^\s*//;
   $instring     =~ s/\s*$//;

 PARSE: {

      # First, we'll try the standard format (without a mode string)

      ($err,@delta) = $dmb->_split_delta($instring);
      last PARSE  if (! $err);

      # Next, we'll need to get a list of all the encodings and look
      # for (and remove) the mode string from each.  We'll also recheck
      # the standard format for each.

      my @strings = $dmb->_encoding($instring);
      my $moderx  = $self->_rx('mode');
      my %mode    = ();

      foreach my $string (@strings) {
         if ($string =~ s/\s*$moderx\s*//i) {
            my $b = $1;
            if ($$dmb{'data'}{'wordmatch'}{'mode'}{lc($b)} == 1) {
               $b = 0;
            } else {
               $b = 1;
            }

            ($err,@delta) = $dmb->_split_delta($string);
            if (! $err) {
               $business = $b;
               $gotmode  = 1;
               last PARSE;
            }

            $mode{$string} = $b;
         }
      }

      # Now we'll check each string for an expanded form delta.

      foreach my $string (@strings) {
         my($b,$g);
         if (exists $mode{$string}) {
            $b = $mode{$string};
            $g = 1;
         } else {
            $b = $business;
            $g = 0;
         }

         my $past    = 0;

         my $whenrx  = $self->_rx('when');
         if ($string  &&
             $string =~ s/$whenrx//i) {
            my $when = $1;
            if ($$dmb{'data'}{'wordmatch'}{'when'}{lc($when)} == 1) {
               $past   = 1;
            }
         }

         my $rx        = $self->_rx('expanded');
         if ($string  &&
             $string   =~ $rx) {
            $business  = $b;
            $gotmode   = $g;
            @delta     = @+{qw(y m w d h mn s)};
            foreach my $f (@delta) {
               if (! defined $f) {
                  $f = 0;
               } elsif (exists $$dmb{'data'}{'wordmatch'}{'nth'}{lc($f)}) {
                  $f = $$dmb{'data'}{'wordmatch'}{'nth'}{lc($f)};
               } else {
                  $f =~ s/\s//g;
               }
            }

            # if $past, reverse the signs
            if ($past) {
               foreach my $v (@delta) {
                  $v *= -1;
               }
            }

            last PARSE;
         }
      }
   }

   if (! @delta) {
      $$self{'err'} = "[parse] Invalid delta string";
      return 1;
   }

   ($err,@delta) = $dmb->_delta_fields( { 'nonorm'   => $no_normalize,
                                          'business' => $business,
                                          'source'   => 'string',
                                          'sign'     => -1 },
                                        [@delta]);

   if ($err) {
      $$self{'err'} = "[parse] Invalid delta string";
      return 1;
   }

   $$self{'data'}{'in'}         = $instring;
   $$self{'data'}{'delta'}      = [@delta];
   $$self{'data'}{'business'}   = $business;
   $$self{'data'}{'gotmode'}    = $gotmode;
   $$self{'data'}{'length'}     = 'unknown';
   return 0;
}

sub printf {
   my($self,@in) = @_;
   if ($$self{'err'}) {
      warn "WARNING: [printf] Object must contain a valid delta\n";
      return undef;
   }

   my($y,$M,$w,$d,$h,$m,$s) = @{ $$self{'data'}{'delta'} };

   my @out;
   foreach my $in (@in) {
      my $out = '';
      while ($in) {
         if ($in =~ s/^([^%]+)//) {
            $out .= $1;

         } elsif ($in =~ s/^%%//) {
            $out .= "%";

         } elsif ($in =~ s/^%
                           (\+)?                   # sign
                           ([<>0])?                # pad
                           (\d+)?                  # width
                           ([yMwdhms])             # field
                           v                       # type
                          //ox) {
            my($sign,$pad,$width,$field) = ($1,$2,$3,$4);
            $out .= $self->_printf_field($sign,$pad,$width,0,$field);

         } elsif ($in =~ s/^(%
                              (\+)?                   # sign
                              ([<>0])?                # pad
                              (\d+)?                  # width
                              (?:\.(\d+))?            # precision
                              ([yMwdhms])             # field
                              ([yMwdhms])             # field0
                              ([yMwdhms])             # field1
                           )//ox) {
            my($match,$sign,$pad,$width,$precision,$field,$field0,$field1) =
              ($1,$2,$3,$4,$5,$6,$7,$8);

            # Get the list of fields we're expressing

            my @field = qw(y M w d h m s);
            while (@field  &&  $field[0] ne $field0) {
               shift(@field);
            }
            while (@field  &&  $field[$#field] ne $field1) {
               pop(@field);
            }

            if (! @field) {
               $out .= $match;
            } else {
               $out .=
                 $self->_printf_field($sign,$pad,$width,$precision,$field,@field);
            }

         } elsif ($in =~ s/^%
                           (\+)?                   # sign
                           ([<>])?                 # pad
                           (\d+)?                  # width
                           Dt
                          //ox) {
            my($sign,$pad,$width) = ($1,$2,$3);
            $out .= $self->_printf_delta($sign,$pad,$width,'y','s');

         } elsif ($in =~ s/^(%
                              (\+)?                   # sign
                              ([<>])?                 # pad
                              (\d+)?                  # width
                              D
                              ([yMwdhms])             # field0
                              ([yMwdhms])             # field1
                           )//ox) {
            my($match,$sign,$pad,$width,$field0,$field1) = ($1,$2,$3,$4,$5,$6);

            # Get the list of fields we're expressing

            my @field = qw(y M w d h m s);
            while (@field  &&  $field[0] ne $field0) {
               shift(@field);
            }
            while (@field  &&  $field[$#field] ne $field1) {
               pop(@field);
            }

            if (! @field) {
               $out .= $match;
            } else {
               $out .= $self->_printf_delta($sign,$pad,$width,$field[0],
                                            $field[$#field]);
            }

         } else {
            $in =~ s/^(%[^%]*)//;
            $out .= $1;
         }
      }
      push(@out,$out);
   }

   if (wantarray) {
      return @out;
   } elsif (@out == 1) {
      return $out[0];
   }

   return ''
}

sub _printf_delta {
   my($self,$sign,$pad,$width,$field0,$field1) = @_;
   my $dmt = $$self{'tz'};
   my $dmb = $$dmt{'base'};
   my @delta = @{ $$self{'data'}{'delta'} };
   my $delta;
   my %tmp   = qw(y 0 M 1 w 2 d 3 h 4 m 5 s 6);

   # Add a sign to each field

   my $s = "+";
   foreach my $f (@delta) {
      if ($f < 0) {
         $s = "-";
      } elsif ($f > 0) {
         $s = "+";
         $f *= 1;
         $f = "+$f";
      } else {
         $f = "$s$f";
      }
   }

   # Split the delta into field sets containing only those fields to
   # print.
   #
   # @set = ( [SETa] [SETb] ....)
   #   where [SETx] is a listref of fields from one set of fields

   my @set;
   my $business = $$self{'data'}{'business'};

   my $f0 = $tmp{$field0};
   my $f1 = $tmp{$field1};

   if ($field0 eq $field1) {
      @set = ( [ $delta[$f0] ] );

   } elsif ($business) {

      if ($f0 <= 1) {
         # if (field0 = y or M)
         #    add [y,M]
         #    field0 = w   OR   done if field1 = M
         push(@set, [ @delta[0..1] ]);
         $f0 = ($f1 == 1 ? 7 : 2);
      }

      if ($f0 == 2) {
         # if (field0 = w)
         #    add [w]
         #    field0 = d  OR  done if field1 = w
         push(@set, [ $delta[2] ]);
         $f0 = ($f1 == 2 ? 7 : 3);
      }

      if ($f0 <= 6) {
         push(@set, [ @delta[$f0..$f1] ]);
      }

   } else {

      if ($f0 <= 1) {
         # if (field0 = y or M)
         #    add [y,M]
         #    field0 = w   OR   done if field1 = M
         push(@set, [ @delta[0..1] ]);
         $f0 = ($f1 == 1 ? 7 : 2);
      }

      if ($f0 <= 6) {
         push(@set, [ @delta[$f0..$f1] ]);
      }
   }

   # If we're not forcing signs, remove signs from all fields
   # except the first in each set.

   my @ret;

   foreach my $set (@set) {
      my @f = @$set;

      if (defined($sign)  &&  $sign eq "+") {
         push(@ret,@f);
      } else {
         push(@ret,shift(@f));
         foreach my $f (@f) {
            $f =~ s/[-+]//;
            push(@ret,$f);
         }
      }
   }

   # Width/pad

   my $ret = join(':',@ret);
   if ($width  &&  length($ret) < $width) {
      if (defined $pad  &&  $pad eq ">") {
         $ret .= ' 'x($width-length($ret));
      } else {
         $ret = ' 'x($width-length($ret)) . $ret;
      }
   }

   return $ret;
}

sub _printf_field {
   my($self,$sign,$pad,$width,$precision,$field,@field) = @_;

   my $val = $self->_printf_field_val($field,@field);
   $pad    = "<"  if (! defined($pad));

   # Strip off the sign.

   my $s = '';

   if ($val < 0) {
      $s   = "-";
      $val *= -1;
   } elsif ($sign) {
      $s   = "+";
   }

   # Handle the precision.

   if (defined($precision)) {
      $val = sprintf("%.${precision}f",$val);

   } elsif (defined($width)) {
      my $i = $s . int($val) . '.';
      if (length($i) < $width) {
         $precision = $width-length($i);
         $val = sprintf("%.${precision}f",$val);
      }
   }

   # Handle padding.

   if ($width) {
      if      ($pad eq ">") {
         $val = "$s$val";
         $val .= ' 'x($width-length($val));

      } elsif ($pad eq "<") {
         $val = "$s$val";
         $val = ' 'x($width-length($val)) . $val;

      } else {
         $val = $s . '0'x($width-length($val)-length($s)) . $val;
      }
   } else {
      $val = "$s$val";
   }

   return $val;
}

# $$self{'data'}{'f'}{X}{Y} is the value of field X expressed in terms of Y.
#
sub _printf_field_val {
   my($self,$field,@field) = @_;

   if (! exists $$self{'data'}{'f'}{'y'}  &&
       ! exists $$self{'data'}{'f'}{'y'}{'y'}) {

      my($yv,$Mv,$wv,$dv,$hv,$mv,$sv) = map { $_*1 } @{ $$self{'data'}{'delta'} };
      $$self{'data'}{'f'}{'y'}{'y'} = $yv;
      $$self{'data'}{'f'}{'M'}{'M'} = $Mv;
      $$self{'data'}{'f'}{'w'}{'w'} = $wv;
      $$self{'data'}{'f'}{'d'}{'d'} = $dv;
      $$self{'data'}{'f'}{'h'}{'h'} = $hv;
      $$self{'data'}{'f'}{'m'}{'m'} = $mv;
      $$self{'data'}{'f'}{'s'}{'s'} = $sv;
   }

   # A single field

   if (! @field) {
      return $$self{'data'}{'f'}{$field}{$field};
   }

   # Find the length of 1 unit of each field in terms of seconds.

   if (! exists $$self{'data'}{'flen'}{'s'}) {
      my $business = $$self{'data'}{'business'};
      my $dmb      = $self->base();
      $$self{'data'}{'flen'} = { 's'  => 1,
                                 'm'  => 60,
                                 'h'  => 3600,
                                 'd'  => $$dmb{'data'}{'len'}{$business}{'dl'},
                                 'w'  => $$dmb{'data'}{'len'}{$business}{'wl'},
                                 'M'  => $$dmb{'data'}{'len'}{$business}{'ml'},
                                 'y'  => $$dmb{'data'}{'len'}{$business}{'yl'},
                               };
   }

   # Calculate the value for each field.

   my $val = 0;
   foreach my $f (@field) {

      # We want the value of $f expressed in terms of $field

      if (! exists $$self{'data'}{'f'}{$f}{$field}) {

         # Get the value of $f expressed in seconds

         if (! exists $$self{'data'}{'f'}{$f}{'s'}) {
            $$self{'data'}{'f'}{$f}{'s'} =
              $$self{'data'}{'f'}{$f}{$f} * $$self{'data'}{'flen'}{$f};
         }

         # Get the value of $f expressed in terms of $field

         $$self{'data'}{'f'}{$f}{$field} =
           $$self{'data'}{'f'}{$f}{'s'} / $$self{'data'}{'flen'}{$field};
      }

      $val += $$self{'data'}{'f'}{$f}{$field};
   }

   return $val;
}

sub type {
   my($self,$op) = @_;
   $op = lc($op);

   if      ($op eq 'business') {
      return $$self{'data'}{'business'};
   } elsif ($op eq 'standard') {
      return 1-$$self{'data'}{'business'};
   }

   my($exact,$semi,$approx) = (0,0,0);
   my($y,$m,$w,$d,$h,$mn,$s) = @{ $$self{'data'}{'delta'} };
   if ($y  ||  $m) {
      $approx = 1;
   } elsif ($w  ||  (! $$self{'data'}{'business'}  &&  $d)) {
      $semi = 1;
   } else {
      $exact = 1;
   }

   if      ($op eq 'exact') {
      return $exact;
   } elsif ($op eq 'semi') {
      return $semi;
   } elsif ($op eq 'approx') {
      return $approx;
   }

   return undef;
}

sub calc {
   my($self,$obj,$subtract,$no_normalize) = @_;
   if ($$self{'err'}) {
      $$self{'err'} = "[calc] First object invalid (delta)";
      return undef;
   }

   if      (ref($obj) eq 'Date::Manip::Date') {
      if ($$obj{'err'}) {
         $$self{'err'} = "[calc] Second object invalid (date)";
         return undef;
      }
      return $obj->calc($self,$subtract);

   } elsif (ref($obj) eq 'Date::Manip::Delta') {
      if ($$obj{'err'}) {
         $$self{'err'} = "[calc] Second object invalid (delta)";
         return undef;
      }
      return $self->_calc_delta_delta($obj,$subtract,$no_normalize);

   } else {
      $$self{'err'} = "[calc] Second object must be a Date/Delta object";
      return undef;
   }
}

sub _calc_delta_delta {
   my($self,$delta,@args) = @_;
   my $dmt = $$self{'tz'};
   my $dmb = $$dmt{'base'};
   my $ret = $self->new_delta;

   if ($self->err()) {
      $$ret{'err'} = "[calc] First delta object invalid";
      return $ret;
   } elsif ($delta->err()) {
      $$ret{'err'} = "[calc] Second delta object invalid";
      return $ret;
   }

   my($subtract,$no_normalize);
   if (@args == 2) {
      ($subtract,$no_normalize) = @args;
   } elsif ($args[0] eq 'nonormalize') {
      $subtract     = 0;
      $no_normalize = 1;
   } else {
      $subtract     = 0;
      $no_normalize = 0;
   }

   my $business = 0;
   if ($$self{'data'}{'business'} != $$delta{'data'}{'business'}) {
      $$ret{'err'} = "[calc] Delta/delta calculation objects must be of " .
        'the same type';
      return $ret;
   } else {
      $business = $$self{'data'}{'business'};
   }

   my ($err,@delta);
   for (my $i=0; $i<7; $i++) {
      if ($subtract) {
         $delta[$i] = $$self{'data'}{'delta'}[$i] - $$delta{'data'}{'delta'}[$i];
      } else {
         $delta[$i] = $$self{'data'}{'delta'}[$i] + $$delta{'data'}{'delta'}[$i];
      }
   }

   ($err,@delta) = $dmb->_delta_fields( { 'nonorm'  => 0,
                                          'source'  => 'delta',
                                          'sign'    => -1 },
                                        [@delta])  if (! $no_normalize);

   $$ret{'data'}{'delta'}       = [@delta];
   $$ret{'data'}{'business'}    = $business;
   $$self{'data'}{'length'}     = 'unknown';

   return $ret;
}

sub convert {
   my($self,$to) = @_;

   # What mode are we currently in

   my $from;
   my($y,$m,$w,$d,$h,$mn,$s) = @{ $$self{'data'}{'delta'} };
   if ($y  ||  $m) {
      $from = 'approx';
   } elsif ($w  ||  (! $$self{'data'}{'business'}  &&  $d)) {
      $from = 'semi';
   } else {
      $from = 'exact';
   }

   my $business = $$self{'data'}{'business'};

   #
   # Do the conversion
   #

   {
      no integer;

      my $dmb = $self->base();
      my $yl  = $$dmb{'data'}{'len'}{$business}{'yl'};
      my $ml  = $$dmb{'data'}{'len'}{$business}{'ml'};
      my $wl  = $$dmb{'data'}{'len'}{$business}{'wl'};
      my $dl  = $$dmb{'data'}{'len'}{$business}{'dl'};

      # Convert it to seconds

      $s += $y*$yl + $m*$ml + $w*$wl + $d*$dl + $h*3600 + $mn*60;
      ($y,$m,$w,$d,$h,$mn) = (0,0,0,0,0,0);

      # Convert it to $to

      if ($to eq 'approx') {
         # Figure out how many months there are
         $m          = int($s/$ml);
         $s         -= $m*$ml;
      }

      if ($to eq 'approx'  ||  $to eq 'semi') {
         if ($business) {
            $w       = int($s/$wl);
            $s      -= $w*$wl;
         } else {
            $d       = int($s/$dl);
            $s      -= $d*$dl;
         }
      }

      $s = int($s);
   }

   $self->set('delta',[$y,$m,$w,$d,$h,$mn,$s]);
}

sub cmp {
   my($self,$delta) = @_;

   if ($$self{'err'}) {
      warn "WARNING: [cmp] Arguments must be valid deltas: delta1\n";
      return undef;
   }

   if (! ref($delta) eq 'Date::Manip::Delta') {
      warn "WARNING: [cmp] Argument must be a Date::Manip::Delta object\n";
      return undef;
   }
   if ($$delta{'err'}) {
      warn "WARNING: [cmp] Arguments must be valid deltas: delta2\n";
      return undef;
   }

   if ($$self{'data'}{'business'} != $$delta{'data'}{'business'}) {
      warn "WARNING: [cmp] Deltas must both be business or standard\n";
      return undef;
   }

   my $business = $$self{'data'}{'business'};
   my $dmb      = $self->base();
   my $yl       = $$dmb{'data'}{'len'}{$business}{'yl'};
   my $ml       = $$dmb{'data'}{'len'}{$business}{'ml'};
   my $wl       = $$dmb{'data'}{'len'}{$business}{'wl'};
   my $dl       = $$dmb{'data'}{'len'}{$business}{'dl'};

   if ($$self{'data'}{'length'} eq 'unknown') {
      my($y,$m,$w,$d,$h,$mn,$s) = @{ $$self{'data'}{'delta'} };

      no integer;
      $$self{'data'}{'length'}  = int($y*$yl + $m*$ml + $w*$wl +
                                      $d*$dl + $h*3600 + $mn*60 + $s);
   }

   if ($$delta{'data'}{'length'} eq 'unknown') {
      my($y,$m,$w,$d,$h,$mn,$s) = @{ $$delta{'data'}{'delta'} };

      no integer;
      $$delta{'data'}{'length'}  = int($y*$yl + $m*$ml + $w*$wl +
                                       $d*$dl + $h*3600 + $mn*60 + $s);
   }

   return ($$self{'data'}{'length'} cmp $$delta{'data'}{'length'});
}

1;
# Local Variables:
# mode: cperl
# indent-tabs-mode: nil
# cperl-indent-level: 3
# cperl-continued-statement-offset: 2
# cperl-continued-brace-offset: 0
# cperl-brace-offset: 0
# cperl-brace-imaginary-offset: 0
# cperl-label-offset: 0
# End:
