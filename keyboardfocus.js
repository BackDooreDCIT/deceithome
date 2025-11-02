$('body').on('keydown', function() {
    var input = $('input[name="q"]');

    if(!input.is(':focus')) {
        input.focus();
    }

});