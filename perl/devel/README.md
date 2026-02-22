# Developing RecordStream

## Releasing to CPAN

Congrats, you're about to release a new version of recs to the world!
You'll need a few things before you get started:

* All the development and feature deps.  Install them with:

      cpanm --installdeps --with-develop --with-recommends --with-all-features .

  The feature deps are important so that no tests are skipped.

* A [PAUSE][] ID with co-maintainer permissions on all App::RecordStream
  packages.

* A PGP key configured for use with `gpg` and `git`.  Make sure that
  `git config user.signingkey` reports the ID or fingerprint for your
  key pair.

Once you have those, the release process is almost entirely managed by
[Dist::Zilla][] using the `dzil` command.  Let's get started!

1. Ensure your working directory is clean and up to date with the master
   branch on Github.

3. Update the Changes file with a description of the changes since the
   last release.  Look at the changes for previous versions as an
   example.  The Changes file is primarily for humans, so aim to make it
   useful for a person wondering what's new.  Verbatim commit messages,
   for example, do not generally make good entries in a release change log.

   Leave your changes to the Changes file uncommitted when you're done.
   It'll be committed by dzil as part of the release commit.

4. Run `dzil release` and follow the prompts.  :-)  You'll be asked for
   the next release version, but the default is usually correct.

   dzil will bump versions, do some housekeeping and sanity checks, run
   the tests twice — once as normal and again with minimal deps to test
   optional features degrade correctly — and finally build the release
   tarball.

5. If all goes well, dzil will prompt you to confirm the release before
   upload.  Assuming all looks good, answer `y` to upload the release
   tarball to CPAN using `cpan-upload`.  You may be asked for your
   [PAUSE][] username and password if you haven't used `cpan-upload` before
   and don't have a `~/.pause` file.

6. After successfully uploading the release to CPAN, dzil makes the
   release commit, tags it, and pushes it to Github.  Look on Github to
   make sure it did, and then wait for email from PAUSE.  The second one,
   the PAUSE indexer report, should contain `Status of this distro: OK` if
   nothing went wrong.  If it doesn't, there's probably a permissions
   issue.

[Dist::Zilla]: https://metacpan.org/pod/Dist::Zilla
[PAUSE]: https://pause.perl.org

## Building standalone (fatpacked) recs

Normally running

    $ dzil build --no-tgz && dzil clean
    
    # ...or if you have Dist::Zilla::App::Command::update installed:
    $ dzil update

will build a fatpacked version of recs for you.  You can also run the following
yourself:

    $ devel/update-fatlib --upgrade-local
    $ devel/fatpack-recs

These will produce or update the following:

    local/      a local::lib with the minimal, pure-Perl only deps for recs
    fatlib/     fatpack's copy of the necessary modules from local/
    recs        a fatpacked copy of bin/recs, ready to run

After the initial run, update-fatlib can be run without --upgrade-local to keep
the module versions already installed into local/.  The flag simply runs cpanm
to upgrade the dependencies before proceeding.  devel/fatpack-recs will take
several minutes the first time, before perlstrip has initialized its cache.

You can test that the fatpacked recs works by doing this:

    $ perl -Mlib::core::only recs fromcsv <<<foo,bar,baz

All core operations should also be listed by running:

    $ perl -Mlib::core::only recs -l

and core aggregators should function:

    $ perl -Mlib::core::only recs collate -a count <<<'{}'

See also tests/RecordStream/recs-fatpack.t.
