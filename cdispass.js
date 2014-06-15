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

function dispass_completer()
{
    keywords(arguments);
    completer.call(this, forward_keywords(arguments));
}
dispass_completer.prototype = {
    constructor: dispass_completer,
    __proto__: completer.prototype,
    toString: function () "#<dispass_completer>",
    complete: function (input, pos) {
        if (pos == 0)
            yield co_return(undefined);

        let str = input.substring(0, pos);

        var data = "", error = "", ret = [];
        var result = yield shell_command(
            dispass_executable + " list --script",
            $fds = [{ output: async_binary_string_writer("") },
                    { input: async_binary_reader(
                        function (s) data += s || "" ) },
                    { input: async_binary_reader(
                        function (s) error += s || "") }]);

        if (result != 0 || error != "")
            throw new Error("result: " + result + ", error: " + error);
        else if (data != "") {
            data.split('\n').forEach(function (row) {
                let match = /(^.{50})/.exec(row);
                if (match && (str == "" || match[1].contains(str)))
                    ret.push(match[1].trim());
            });

            yield co_return(new completions(this, ret));
        }
    }
};

function dispass_interactive(with_submit) {
    return function (I) {
        if (!I.buffer.focused_element) {
            I.minibuffer.message("No input selected.");
            yield co_return(null);
        }

        let label = yield I.minibuffer.read(
            $prompt="label:", $auto_complete=true,
            $completer=new dispass_completer()
        );

        I.minibuffer.input_element.type = "password";
        let password = yield I.minibuffer.read(
            $prompt="password:"
        );
        I.minibuffer.input_element.type = "";

        I.buffer.focused_element.value =
            (yield dispass(label, password));

        if (with_submit)
            I.buffer.focused_element.form.submit();
    };
}

interactive("dispass",
            "Call DisPass to generate a passphrase.\n"
            + "\n"
            + "Put the result in the currently focused input.",
            dispass_interactive(false));
interactive("dispass-and-submit",
            "Call Dispass to generate a passphrase.\n"
            + "\n"
            + "Put the result in the currently focused input and"
            + " submit the input's form.",
            dispass_interactive(true));

provide("cdispass");
