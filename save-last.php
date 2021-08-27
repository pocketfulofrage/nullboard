<?php
    $last_board = $_POST['last_board'];
    $board_id = '';
    # if board_id passed
    if($last_board != ''){
        $board_id = $last_board;
    }
    # if board_id is cleared, use first file in directory
    else{
        $fileList = glob('boards/*');
        $first = $fileList[0];
        $board_id = substr($first,7);
    }
    $myfile = fopen("last-board.txt",'w') or die('Unable');
    $txt=$board_id;
    fwrite($myfile,$txt);
    fclose($myfile);
?>
