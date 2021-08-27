<?php
    $blob_id = $_POST['blob_id'];
    $blob_info = $_POST['blob_info'];
    # check if boards directory exists, and if not make it
    $boards_dir = "boards";
    if(!file_exists($boards_dir)){
        mkdir("boards", 0777);
    }
    # save file as 'files/blob_id'
    $myfile = fopen("boards/" . $blob_id,'w') or die('Unable');
    $txt=$blob_info;
    fwrite($myfile,$txt);
    fclose($myfile);
?>
