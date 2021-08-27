var nb_codeVersion = 20200429;
var nb_dataVersion = 20190412;
var drag = new Drag();
var $overlay = $('.overlay');
$(window).resize(adjustLayout);
adjustLayout();

function Note(text){
    this.text = text;
    this.raw  = false;
    this.min  = false;
}
function List(title){
    this.title = title;
    this.notes = [ ];
    this.addNote = function(text){
        var x = new Note(text);
        this.notes.push(x);
        return x;
    }
}
function Board(title){
    this.format   = nb_dataVersion;
    this.id       = +new Date();
    this.title    = title;
    this.lists    = [ ];
    this.addList = function(title){
        var x = new List(title);
        this.lists.push(x);
        return x;
    }
}
function htmlEncode(raw){
    return $('tt .encoder').text(raw).html();
}
function htmlDecode(enc){
    return $('tt .encoder').html(enc).text();
}
function setText($note, text){
    $note.attr('_text', text);
    text = htmlEncode(text);
    hmmm = /\b(https?:\/\/[^\s]+)/mg;
    text = text.replace(hmmm, function(url){
        return '<a href="' + url + '" target=_blank>' + url + '</a>';
    });
    $note.html(text);
}
function getText($note){
    return $note.attr('_text');
}
function updatePageTitle(){
    if (! document.board){
        document.title = 'Nullboard';
        return;
    }
    var $text = $('.wrap .board > .head .text');
    var title = getText( $text );
    document.board.title = title;
    document.title = 'NB - ' + (title || '(unnamed board)');
}
async function showBoard(quick){
    var board = document.board;
    var $wrap = $('.wrap');
    var $bdiv = $('tt .board');
    var $ldiv = $('tt .list');
    var $ndiv = $('tt .note');
    var $b = $bdiv.clone();
    var $b_lists = $b.find('.lists');
    $b[0].board_id = board.id;
    setText( $b.find('.head .text'), board.title );
    board.lists.forEach(function(list){
        var $l = $ldiv.clone();
        var $l_notes = $l.find('.notes');
        setText( $l.find('.head .text'), list.title );
        list.notes.forEach(function(n){
            var $n = $ndiv.clone();
            setText( $n.find('.text'), n.text );
            if (n.raw) $n.addClass('raw');
            if (n.min) $n.addClass('collapsed');
            $l_notes.append($n);
        });
        $b_lists.append($l);
    });
    if (quick){
        $wrap.html('').append($b);
    }
    else{
        $wrap.html('')
            .css({ opacity: 0 })
            .append($b)
            .animate({ opacity: 1 });
    }
    updatePageTitle();
    await updateBoardIndex();
    setupListScrolling();
}
async function saveBoard(){
    var $board = $('.wrap .board');
    var board = new Board( getText($board.find('> .head .text')) );
    $board.find('.list').each(function(){
        var $list = $(this);
        var l = board.addList( getText($list.find('.head .text')) );
        $list.find('.note').each(function(){
            var $note = $(this)
            var n = l.addNote( getText($note.find('.text')) );
            n.raw = $note.hasClass('raw');
            n.min = $note.hasClass('collapsed');
        });
    });
    var blob_id = document.board.id;
    console.log('Saved ' + board.title);
    // save blob data to file
    var formData = new FormData();
    formData.append('blob_id', blob_id);
    formData.append('blob_info', JSON.stringify(board));
    var request = new XMLHttpRequest();
    request.open('POST', "save-board.php");
    request.send(formData);
    await updateBoardIndex();
    setLastBoard(blob_id);
}
function setLastBoard(board_id){
    var formData = new FormData();
    formData.append('last_board', board_id);
    var request = new XMLHttpRequest();
    request.open('POST', "save-last.php");
    request.send(formData);
}
async function getLastBoard(){
    const response = await fetch("last-board.txt");
    const board = await response.text();
    return board;
}
function parseBoard(blob){
    var board;
    try{
        board = JSON.parse(blob);
    }
    catch(x){
        console.log('Malformed JSON');
        return false;
    }
    if (typeof board.format === 'undefined'){
        console.log('Board.format is missing');
        return false;
    }
    if (board.format != nb_dataVersion){
        console.log('Board.format is wrong', board.format, nb_dataVersion);
        return false;
    }
    return $.extend(new Board, board);
}
async function loadBoard(board_id){
    const response = await fetch("boards/"+board_id);
    const blob = await response.json();
    if (! blob){
        return false;
    }
    var board = blob;
    if (! board){
        alert('Whoops. Error parsing board data.');
        console.log('Whoops, there it is:', blob);
        return false;
    }
    board.id = board_id;
    return board;
}
async function nukeBoard(){
    var board_id = document.board.id;
    var formData = new FormData();
    formData.append('board_id', board_id);
    const response = await fetch('nuke-board.php',{
        method: 'POST',
        body: formData
    });
    const text = await response.text();
    console.log(text);
    setLastBoard('');
}
function startEditing($text, ev){
    var $note = $text.parent();
    var $edit = $note.find('.edit');
    $note[0]._collapsed = $note.hasClass('collapsed');
    $note.removeClass('collapsed');
    $edit.val( getText($text) );
    $edit.width( $text.width() );
    $edit.height( $text.height() );
    $note.addClass('editing');
    $edit.focus();
}
function stopEditing($edit, via_escape){
    var $item = $edit.parent();
    if (! $item.hasClass('editing')){
        return;
    }
    $item.removeClass('editing');
    if ($item[0]._collapsed){
        $item.addClass('collapsed');
    }
    var $text = $item.find('.text');
    var text_now = $edit.val().trimRight();
    var text_was = getText( $text );
    var brand_new = $item.hasClass('brand-new');
    $item.removeClass('brand-new');
    if (via_escape){
        if (brand_new){
            $item.closest('.note, .list, .board').remove();
            return;
        }
    }
    else if (text_now != text_was || brand_new){
        setText( $text, text_now );
        saveBoard();
        updatePageTitle();
    }
    if (brand_new && $item.hasClass('list')){
        addNote($item);
    }
    
}
function addNote($list, $after, $before){
    var $note  = $('tt .note').clone();
    var $notes = $list.find('.notes');
    $note.find('.text').html('');
    $note.addClass('brand-new');
    if ($before){
        $before.before($note);
        $note = $before.prev();
    }
    else{}
    if ($after){
        $after.after($note);
        $note = $after.next();
    }
    else{
        $notes.append($note);
        $note = $notes.find('.note').last();
    }
    $note.find('.text').click();
}
function deleteNote($note){
    $note
    .animate({ opacity: 0 }, 'fast')
    .slideUp('fast')
    .queue(function(){
        $note.remove();
        saveBoard();
    });
}
function addList(){
    var $board = $('.wrap .board');
    var $lists = $board.find('.lists');
    var $list = $('tt .list').clone();
    $list.find('.text').html('');
    $list.find('.head').addClass('brand-new');
    $lists.append($list);
    $board.find('.lists .list .head .text').last().click();
    var lists = $lists[0];
    lists.scrollLeft = Math.max(0, lists.scrollWidth - lists.clientWidth);
    setupListScrolling();
}
function deleteList($list){
    var empty = true;
    $list.find('.note .text').each(function(){
        empty &= ($(this).html().length == 0);
    });
    if (! empty && ! confirm("Delete this list and all its notes?")){
        return;
    }
    $list
    .animate({ opacity: 0 })
    .queue(function(){
        $list.remove();
        saveBoard();
    });
    setupListScrolling();
}
function moveList($list, left){
    var $a = $list;
    var $b = left ? $a.prev() : $a.next();
    var $menu_a = $a.find('> .head .menu .bulk');
    var $menu_b = $b.find('> .head .menu .bulk');
    var pos_a = $a.offset().left;
    var pos_b = $b.offset().left;
    $a.css({ position: 'relative' });
    $b.css({ position: 'relative' });
    $menu_a.hide();
    $menu_b.hide();
    $a.animate({ left: (pos_b - pos_a) + 'px' }, 'fast');
    $b.animate({ left: (pos_a - pos_b) + 'px' }, 'fast', function(){
        if (left) $list.prev().before($list);
        else      $list.before($list.next());
        $a.css({ position: '', left: '' });
        $b.css({ position: '', left: '' });
        $menu_a.css({ display: '' });
        $menu_b.css({ display: '' });
        saveBoard();
    });
}
async function openBoard(board_id){
    closeBoard(true);
    document.board = await loadBoard(board_id);
    setLastBoard(board_id);
    showBoard(true);
}
async function closeBoard(quick){
    var $board = $('.wrap .board');
    if (quick){
        $board.remove();
    }
    else{
        $board
            .animate({ opacity: 0 }, 'fast')
            .queue(function(){ $board.remove(); });
    }
    document.board = null;
    setLastBoard('');
}
function addBoard(){
    document.board = new Board('');
    setLastBoard(document.board.id);
    showBoard(false);
    $('.wrap .board .head').addClass('brand-new');
    $('.wrap .board .head .text').click();
}
async function deleteBoard(){
    var $list = $('.wrap .board .list');
    if ($list.length && ! confirm("PERMANENTLY delete this board, all its lists and their notes?")){
        return;
    }
    await nukeBoard();
    await updateBoardIndex();
    closeBoard();
}
function Drag(){
    this.item    = null;                // .text of .note
    this.priming = null;
    this.primexy = { x: 0, y: 0 };
    this.$drag   = null;
    this.mouse   = null;
    this.delta   = { x: 0, y: 0 };
    this.in_swap = false;
    this.prime = function(item, ev){
        var self = this;
        this.item = item;
        this.priming = setTimeout(function(){ self.onPrimed.call(self); }, ev.altKey ? 1 : 500);
        this.primexy.x = ev.clientX;
        this.primexy.y = ev.clientY;
        this.mouse = ev;
    }
    this.cancelPriming = function(){
        if (this.item && this.priming)
        {
            clearTimeout(this.priming);
            this.priming = null;
            this.item = null;
        }
    }
    this.end = function(){
        this.cancelPriming();
        this.stopDragging();
    }
    this.isActive = function(){
        return this.item && (this.priming == null);
    }
    this.onPrimed = function(){
        clearTimeout(this.priming);
        this.priming = null;
        this.item.was_dragged = true;
        var $text = $(this.item);
        var $note = $text.parent();
        $note.addClass('dragging');
        $('body').append('<div class=dragster></div>');
        var $drag = $('body .dragster').last();
        if ($note.hasClass('collapsed')){
            $drag.addClass('collapsed');
        }
        $drag.html( $text.html() );
        $drag.innerWidth ( $note.innerWidth()  );
        $drag.innerHeight( $note.innerHeight() );
        this.$drag = $drag;
        var $win = $(window);
        var scroll_x = $win.scrollLeft();
        var scroll_y = $win.scrollTop();
        var pos = $note.offset();
        this.delta.x = pos.left - this.mouse.clientX - scroll_x;
        this.delta.y = pos.top  - this.mouse.clientY - scroll_y;
        this.adjustDrag();
        $drag.css({ opacity: 1 });
        $('body').addClass('dragging');
    }
    this.adjustDrag = function(){
        if (! this.$drag){
            return;
        }
        var $win = $(window);
        var scroll_x = $win.scrollLeft();
        var scroll_y = $win.scrollTop();
        var drag_x = this.mouse.clientX + this.delta.x + scroll_x;
        var drag_y = this.mouse.clientY + this.delta.y + scroll_y;
        this.$drag.offset({ left: drag_x, top: drag_y });
        if (this.in_swap){
            return;
        }
        //	see if a swap is in order
        var pos = this.$drag.offset();
        var x = pos.left + this.$drag.width()/2 - $win.scrollLeft();
        var y = pos.top + this.$drag.height()/2 - $win.scrollTop();
        var drag = this;
        var prepend = null;   // if dropping on the list header
        var target = null;    // if over some item
        var before = false;   // if should go before that item
        $(".board .list").each(function(){
            var list = this;
            var rc = list.getBoundingClientRect();
            var y_min = rc.bottom;
            var n_min = null;
            if (x <= rc.left || rc.right <= x || y <= rc.top || rc.bottom <= y)
                return;
            var $list = $(list);
            $list.find('.note').each(function(){
                var note = this;
                var rc = note.getBoundingClientRect();
                if (rc.top < y_min){
                    y_min = rc.top;
                    n_min = note;
                }
                if (y <= rc.top || rc.bottom <= y){
                    return;
                }
                if (note == drag.item.parentNode){
                    return;
                }
                target = note;
                before = (y < (rc.top + rc.bottom)/2);
            });
            //	dropping on the list header
            if (! target && y < y_min){
                if (n_min){ // non-empty list
                    target = n_min;
                    before = true;
                }
                else{
                    prepend = list;
                }
            }
        });
        if (! target && ! prepend){
            return;
        }
        if (target){
            if (target == drag.item.parentNode){
                return;
            }
            if (! before && target.nextSibling == drag.item.parentNode ||
                    before && target.previousSibling == drag.item.parentNode){
                return;
            }
        }
        else{
            if (prepend.firstChild == drag.item.parentNode){
                return;
            }
        }
        //swap em
        var $have = $(this.item.parentNode);
        var $want = $have.clone();
        $want.css({ display: 'none' });
        if (target){
            var $target = $(target);
            if (before){
                $want.insertBefore($target);
                $want = $target.prev();
            }
            else{
                $want.insertAfter($target);
                $want = $target.next();
            }
            drag.item = $want.find('.text')[0];
        }
        else{
            var $notes = $(prepend).find('.notes');
            $notes.prepend($want);
            drag.item = $notes.find('.note .text')[0];
        }
        var h = $have.height();
        drag.in_swap = true;
        $have.animate({ height: 0 }, 'fast', function(){
            $have.remove();
            $want.css({ marginTop: 5 });
            saveBoard();
        });
        $want.css({ display: 'block', height: 0, marginTop: 0 });
        $want.animate({ height: h }, 'fast', function(){
            $want.css({ opacity: '', height: '' });
            drag.in_swap = false;
            drag.adjustDrag();
        });
    }
    this.onMouseMove = function(ev){
        this.mouse = ev;
        if (! this.item){
            return;
        }
        if (this.priming){
            var x = ev.clientX - this.primexy.x;
            var y = ev.clientY - this.primexy.y;
            if (x*x + y*y > 5*5)
                this.onPrimed();
        }
        else{
            this.adjustDrag();
        }
    }
    this.stopDragging = function(){
        $(this.item).parent().removeClass('dragging');
        $('body').removeClass('dragging');
        if (this.$drag){
            this.$drag.remove();
            this.$drag = null;
            if (window.getSelection) { window.getSelection().removeAllRanges(); }
            else if (document.selection) { document.selection.empty(); }
        }
        this.item = null;
    }
}
async function peekBoardTitle(board_id){
    const response = await fetch("boards/"+board_id);
    const blob = await response.text();
    if(! blob){
        return false;
    }
    var head = blob.indexOf(',"title":"');
    head = head + 10;
    var tail = blob.indexOf('","lists');
    var peek = blob.substring(head, tail);
    return peek;
}
async function updateBoardIndex(){
    var $index  = $('.config .boards');
    var $entry  = $('tt .load-board');
    var id_now = document.board && document.board.id;
    var empty = true;
    $index.html('');
    $index.hide();
    // get files from php
    const response = await (await fetch('get-boards.php')).text();
    // split at @ and remove empty elements
    var array = response.split("@");
    array = array.filter(n => n);
    for (var i=0; i<array.length; i++){
        var board_id = array[i];
        var title = await peekBoardTitle(board_id);
        var $e = $entry.clone();
        $e[0].board_id = board_id;
        $e.html( title || '(unnamed board)' );
        if (board_id == id_now){
            $e.addClass('active');
        }
        $index.append($e);
        empty = false;
    }
    if (! empty){
        $index.show();
    }
}
function showDing(){
    $('body')
    .addClass('ding')
    .delay(100)
    .queue(function(){ $(this).removeClass('ding').dequeue(); });
}
function showOverlay($overlay, $div){
    $overlay
    .html('')
    .append($div)
    .css({ opacity: 0, display: 'block' })
    .animate({ opacity: 1 });
}
function hideOverlay($overlay){
    $overlay.animate({ opacity: 0 }, function(){
        $overlay.hide();
    });
}
async function formatLicense(){
    const response = await fetch('LICENSE');
    const responseText = await response.text();
    var text = responseText;
    var pos = text.search('LICENSE');
    var qos = text.search('Software:');
    var bulk;
    bulk = text.substr(pos, qos-pos);
    bulk = bulk.replace(/([^\n])\n\t/g, '$1 ');
    bulk = bulk.replace(/\n\n\t/g, '\n\n');
    bulk = bulk.replace(/([A-Z ]{7,})/g, '<u>$1</u>');
    var c1 = [];
    var c2 = [];
    text.substr(qos).trim().split('\n').forEach(function(line){
        line = line.split(':');
        c1.push( line[0].trim() + ':' );
        c2.push( line[1].trim() );
    });
    bulk += '<span>' + c1.join('<br>') + '</span>';
    bulk += '<span>' + c2.join('<br>') + '</span>';
    var links =
    [
        { text: '2-clause BSD license', href: 'https://opensource.org/licenses/BSD-2-Clause/' },
        { text: 'Commons Clause',       href: 'https://commonsclause.com/' }
    ];
    links.forEach(function(l){
        bulk = bulk.replace(l.text, '<a href="' + l.href + '" target=_blank>' + l.text + '</a>');
    });
    return bulk.trim();
}
function setRevealState(ev){
    var raw = ev.originalEvent;
    var caps = raw.getModifierState && raw.getModifierState( 'CapsLock' );
    if (caps){
        $('body').addClass('reveal');
    }
    else{
        $('body').removeClass('reveal');
    }
}
$(window).live('blur', function(){
    $('body').removeClass('reveal');
});
$(document).live('keydown', function(ev){
    setRevealState(ev);
});
$(document).live('keyup', function(ev){
    var raw = ev.originalEvent;
    setRevealState(ev);
    if (ev.target.nodeName == 'TEXTAREA' ||
        ev.target.nodeName == 'INPUT'){
        return;
        }
});
$('.board .text').live('click', function(ev){
    if (this.was_dragged){
        this.was_dragged = false;
        return false;
    }
    drag.cancelPriming();
    startEditing($(this), ev);
    return false;
});
$('.board .note .text a').live('click', function(ev){
    if (! $('body').hasClass('reveal'))
        return true;
    ev.stopPropagation();
    return true;
});
function handleTab(ev){
    var $this = $(this);
    var $note = $this.closest('.note');
    var $sibl = ev.shiftKey ? $note.prev() : $note.next();
    if ($sibl.length){
        stopEditing($this, false);
        $sibl.find('.text').click();
    }
}
$('.board .edit').live('keydown', function(ev){
    // esc
    if (ev.keyCode == 27){
        stopEditing($(this), true);
        return false;
    }
    // tab
    if (ev.keyCode == 9){
        handleTab.call(this, ev);
        return false;
    }
    // enter
    if (ev.keyCode == 13 && ev.ctrlKey){
        var $this = $(this);
        var $note = $this.closest('.note');
        var $list = $note.closest('.list');
        stopEditing($this, false);
        if ($note && ev.shiftKey) // ctrl-shift-enter
            addNote($list, null, $note);
        else
        if ($note && !ev.shiftKey) // ctrl-enter
            addNote($list, $note);
        return false;
    }
    if (ev.keyCode == 13 && this.tagName == 'INPUT' ||
        ev.keyCode == 13 && ev.altKey ||
        ev.keyCode == 13 && ev.shiftKey){
        stopEditing($(this), false);
        return false;
    }
    //
    if (ev.key == '*' && ev.ctrlKey){
        var have = this.value;
        var pos  = this.selectionStart;
        var want = have.substr(0, pos) + '\u2022 ' + have.substr(this.selectionEnd);
        $(this).val(want);
        this.selectionStart = this.selectionEnd = pos + 2;
        return false;
    }
    return true;
});
$('.board .edit').live('keypress', function(ev){
    // tab
    if (ev.keyCode == 9){
        handleTab.call(this, ev);
        return false;
    }
});
$('.board .edit').live('blur', function(ev){
    if (document.activeElement != this)
        stopEditing($(this));
    else
        ; // switch away from the browser window
});
$('.board .note .edit').live('input propertychange', function(){
    var delta = $(this).outerHeight() - $(this).height();
    $(this).height(10);
    if (this.scrollHeight > this.clientHeight)
        $(this).height(this.scrollHeight-delta);
});
$('.config .add-board').live('click', function(){
    addBoard();
    return false;
});
$('.config .load-board').live('click', function(){
    var board_id = $(this)[0].board_id;
    if ((document.board && document.board.id) == board_id)
        closeBoard();
    else
        openBoard( $(this)[0].board_id );
    return false;
});
$('.config .switch-theme').on('click', function() {
    var $html = $('html');
    $html.toggleClass('theme-dark');
    NB.storage.setTheme($html.hasClass('theme-dark') ? 'dark' : '');
    return false;
});
$('.board .del-board').live('click', function(){
    deleteBoard();
    return false;
});
$('.board .add-list').live('click', function(){
    addList();
    return false;
});
$('.board .del-list').live('click', function(){
    deleteList( $(this).closest('.list') );
    return false;
});
$('.board .mov-list-l').live('click', function(){
    moveList( $(this).closest('.list'), true );
    return false;
});
$('.board .mov-list-r').live('click', function(){
    moveList( $(this).closest('.list'), false );
    return false;
});
$('.board .add-note').live('click', function(){
    addNote( $(this).closest('.list') );
    return false;
});
$('.board .del-note').live('click', function(){
    deleteNote( $(this).closest('.note') );
    return false;
});
$('.board .raw-note').live('click', function(){
    $(this).closest('.note').toggleClass('raw');
    saveBoard();
    return false;
});
$('.board .collapse').live('click', function(){
    $(this).closest('.note').toggleClass('collapsed');
    saveBoard();
    return false;
});
$('.board .note .text').live('mousedown', function(ev){
    drag.prime(this, ev);
});
$(document).on('mouseup', function(ev){
    drag.end();
});
$(document).on('mousemove', function(ev){
    setRevealState(ev);
    drag.onMouseMove(ev);
});
$overlay.click(function(ev){
    if (ev.originalEvent.target != this)
        return true;
    hideOverlay($overlay);
    return false;
});
$(window).keydown(function(ev){
    if ($overlay.css('display') != 'none' && ev.keyCode == 27)
        hideOverlay($overlay);
});
$('.view-about').click(function(){
    var $div = $('tt .about').clone();
    $div.find('div').html('Version ' + nb_codeVersion);
    showOverlay($overlay, $div);
    return false;
});
$('.view-license').click(async function(){
    var $div = $('tt .license').clone();
    const text = await formatLicense();
    $div.html(text);
    showOverlay($overlay, $div);
    return false;
});
function adjustLayout(){
    var $body = $('body');
    var $board = $('.board');
    if (! $board.length){
        return;
    }
    var lists = $board.find('.list').length;
    var lists_w = (lists < 2) ? 250 : 260 * lists - 10;
    var body_w = $body.width();
    if (lists_w + 190 <= body_w){
        $board.css('max-width', '');
        $body.removeClass('crowded');
    }
    else{
        var max = Math.floor( (body_w - 40) / 260 );
        max = (max < 2) ? 250 : 260 * max - 10;
        $board.css('max-width', max + 'px');
        $body.addClass('crowded');
    }
}
function adjustListScroller(){
    var $board = $('.board');
    if (! $board.length){
        return;
    }
    var $lists    = $('.board .lists');
    var $scroller = $('.board .lists-scroller');
    var $inner    = $scroller.find('div');
    var max  = $board.width();
    var want = $lists[0].scrollWidth;
    var have = $inner.width();
    if (want <= max){
        $scroller.hide();
        return;
    }
    $scroller.show();
    if (want == have){
        return;
    }
    $inner.width(want);
    cloneScrollPos($lists, $scroller);
}
function cloneScrollPos($src, $dst){
    var src = $src[0];
    var dst = $dst[0];
    if (src._busyScrolling){
        src._busyScrolling--;
        return;
    }
    dst._busyScrolling++;
    dst.scrollLeft = src.scrollLeft;
}
function setupListScrolling(){
    var $lists    = $('.board .lists');
    var $scroller = $('.board .lists-scroller');
    adjustListScroller();
    $lists[0]._busyScrolling = 0;
    $scroller[0]._busyScrolling = 0;
    $scroller.on('scroll', function(){ cloneScrollPos($scroller, $lists); });
    $lists   .on('scroll', function(){ cloneScrollPos($lists, $scroller); });
    adjustLayout();
}
async function main(){
    // get last board id from file
    var board_id = await getLastBoard();
    if (board_id){
        document.board = await loadBoard(board_id);
    }
    await updateBoardIndex();
    if (document.board){
        showBoard(true);
    }
    setInterval(adjustListScroller, 100);
    setupListScrolling();
}
main();
