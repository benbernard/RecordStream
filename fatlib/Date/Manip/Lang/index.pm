package Date::Manip::Lang::index;
# Copyright (c) 2003-2014 Sullivan Beck. All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

########################################################################
########################################################################

=pod

=head1 NAME

Date::Manip::Lang::index - An index of languages supported by Date::Manip

=head1 SYNPOSIS

This module is not intended to be used directly. Other Date::Manip
modules will load it as needed.

=cut

require 5.010000;

use strict;
use warnings;

our($VERSION);
$VERSION='6.47';

our(%Lang);

# A list of languages, and their module name

%Lang = qw(
            catalan     catalan
            ca          catalan

            danish      danish
            da          danish

            dutch       dutch
            nederlands  dutch
            nl          dutch

            english     english
            en          english
            en_us       english

            finnish     finnish
            fi          finnish
            fi_fi       finnish

            french      french
            fr          french
            fr_fr       french

            german      german
            de          german
            de_de       german

            italian     italian
            it          italian
            it_it       italian

            norwegian   norwegian
            nb          norwegian
            nb_no       norwegian

            polish      polish
            pl          polish
            pl_pl       polish

            portuguese  portugue
            pt          portugue
            pt_pt       portugue

            romanian    romanian
            ro          romanian
            ro_ro       romanian

            russian     russian
            ru          russian
            ru_ru       russian

            spanish     spanish
            es          spanish
            es_es       spanish

            swedish     swedish
            sv          swedish

            turkish     turkish
            tr          turkish
            tr_tr       turkish
         );

1;
