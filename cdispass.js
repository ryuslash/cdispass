/* Copyright (C) 2013  Tom Willemse <tom at ryuslash dot org>

 Permission to use, copy, modify, and distribute this software for any
 purpose with or without fee is hereby granted, provided that the
 above copyright notice and this permission notice appear in all
 copies.

 THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
 WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
 WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
 AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL
 DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR
 PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
 TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 PERFORMANCE OF THIS SOFTWARE.
 */
/// Commentary:

// A wrapper script that allows conkeror to interface with DisPass
// (http://dispass.babab.nl).

/// Code:

define_variable("dispass_executable", "dispass",
                "The location of the DisPass executable.");

function dispass(label, password)
{
    let command = dispass_executable + " generate -o -p '" + password
            + "' '" + label + "'";
    let data = "", error = "";
    let ret = yield shell_command(
        command,
        $fds = [{ output: async_binary_string_writer("") },
                { input: async_binary_reader(
                    function (s) data += s || ""
                ) },
                { input: async_binary_reader(
                    function (s) error += s || ""
                ) }]
    );

    if (ret != 0 || error != '')
        throw new Error("DisPass returned " + ret + " with message: "
                        + error);

    let regexp = new RegExp("^" + label + " +(.*)");
    let match = regexp.exec(data);

    if (match)
        yield co_return(match[1]);

    yield co_return(data);
}

function dispass_interactive(I) {
    let label = yield I.minibuffer.read($prompt="label:");

    I.minibuffer.input_element.type = "password";
    let password = yield I.minibuffer.read(
        $prompt="password:"
    );
    I.minibuffer.input_element.type = "";

    I.buffer.focused_element.value = (yield dispass(label, password));
}

interactive("dispass", "Something", dispass_interactive);
interactive("dispass-and-submit", "Something",
            function (I) {
                yield dispass_interactive(I);
                I.buffer.focused_element.form.submit();
            });

provide("cdispass");
