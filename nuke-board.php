<?php
    $board_id = $_POST['board_id'];
    if(!unlink("boards/".$board_id)){
        echo "Unable to nuke board ".$board_id;
    }else{
        echo "Successfully nuked board ".$board_id;
    }
?>
