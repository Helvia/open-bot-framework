import { WebChatChannelDto } from 'src/dto/webchat.dto';
import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column, CreateDateColumn } from 'typeorm';
import { OpenBot } from './openbot.entity';

@Entity()
export class WebChatChannel {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => OpenBot, { onDelete: 'CASCADE' })
    @JoinColumn()
    openBot: OpenBot;

    @Column()
    name: string;

    @Column()
    secret1: string;

    @Column()
    secret2: string;

    @CreateDateColumn()
    createdAt: Date;

    toDto(): WebChatChannelDto {
        return {
            id: this.id,
            name: this.name,
            createdAt: this.createdAt,
            secret1: this.secret1,
            secret2: this.secret2
        };
    }
}
